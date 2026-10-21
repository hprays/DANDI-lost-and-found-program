'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { extractStudentIdFromEmail, getAuthSession } from '@/lib/auth-session';
import {
  clearLostItemOverridesForIds,
  deleteCustomLostItem,
  isLostItemMarkedDeleted,
  markLostItemDeletedForTarget,
} from '@/lib/custom-lost-items';
import {
  findCatalogItemByHint,
  lostItemPk,
  resolveServerLostItemId,
} from '@/lib/catalog-identity';
import {
  enrichPublishedItemsWithReports,
  finalizeCatalogItems,
  getPublishedLostItems,
  mapApiLostItem,
  dedupePublishedCatalog,
  isSameCatalogItem,
  mergePublishedItems,
  pickRicherCatalogStatus,
  removePublishedLostItemByTarget,
  reportToPublishedItem,
  upsertPublishedLostItem,
  type PublishedLostItem,
} from '@/lib/published-lost-items';
import {
  fetchRemoteLostItems,
  invalidateRemoteLostItemsCache,
  sortLostItemsNewestFirst,
} from '@/lib/catalog-utils';
import {
  rememberCatalogStatus,
  rememberItemImage,
  rememberItemTimes,
  reportMetaKey,
} from '@/lib/registration-meta';
import { postLostItemCreate, postReportCreate } from '@/lib/api-upload';
import {
  apiJson,
  API_MUTATION_TIMEOUT_MS,
  getApiBaseUrl,
  patchReportDetails,
  patchReportStatus,
  type ReportPatchPayload,
} from '@/lib/api-json';
import {
  formatDateTimeLabel,
  koreanDateTime,
  normalizeReportStatus,
  parseDateTimeMs,
  sanitizeLocation,
  toApiDateTime,
} from '@/lib/format-display';
import { normalizePickupToken } from '@/lib/pickup-token';
import {
  apiImageFields,
  pickImageFromRaw,
  resolveDisplayImageUrl,
  resolveItemImageUrl,
} from '@/lib/media-url';
import {
  compactDandiLocalStorage,
  imageForLocalStorage,
  safeSetLocalStorage,
} from '@/lib/safe-local-storage';
import {
  getStoredLocalNotices,
  setStoredLocalNotices,
} from '@/lib/user-preferences';

export type ReportStatus = 'pending' | 'resolved' | 'picked_up' | 'unavailable';

export type LostReport = {
  id: string;
  itemName: string;
  category: string;
  lostAt: string;
  location: string;
  memo?: string;
  image?: string;
  itemType?: string;
  storage?: string;
  status: ReportStatus;
  createdAt: string;
  pickedUpAt?: string;
  ownerEmail?: string;
  ownerName?: string;
};

export type UserNotice = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export type AdminAuditLog = {
  id: string;
  message: string;
  createdAt: string;
};

export type PickupPass = {
  id: string;
  // 새 흐름: 분실물(습득물) 기준으로 QR을 발급한다. 기존 reportId 호환을 위해 둘 다 유지.
  lostItemId: string;
  reportId?: string;
  itemName?: string;
  itemImage?: string;
  itemLocation?: string;
  claimantName?: string;
  claimantEmail?: string;
  token: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
};

export type PickupIssuePayload = {
  lostItemId: string;
  itemName?: string;
  itemImage?: string;
  itemLocation?: string;
};

export type PickupVerifyResult = {
  ok: boolean;
  message: string;
  pass?: PickupPass;
};

export type PendingReportPatch = Partial<
  Pick<
    LostReport,
    | 'itemName'
    | 'category'
    | 'lostAt'
    | 'location'
    | 'memo'
    | 'image'
    | 'itemType'
    | 'storage'
  >
>;

type DandiStateContextValue = {
  reports: LostReport[];
  homeLostItems: PublishedLostItem[];
  catalogVersion: number;
  catalogLoading: boolean;
  /** 최초 카탈로그 조회 완료 여부 (빈 목록과 미조회 구분) */
  catalogLoaded: boolean;
  /** 마지막 카탈로그 조회 실패 메시지 */
  catalogError: string | null;
  notices: UserNotice[];
  noticesLoading: boolean;
  noticesError: string | null;
  apiConfigured: boolean;
  apiBaseUrl: string;
  adminAuditLogs: AdminAuditLog[];
  pickupPasses: PickupPass[];
  submitReport: (
    payload: Omit<LostReport, 'id' | 'status' | 'createdAt'>,
  ) => Promise<{ ok: boolean; message: string; reportId?: string }>;
  publishAdminLostItem: (
    payload: Omit<LostReport, 'id' | 'status' | 'createdAt'>,
  ) => Promise<{ ok: boolean; message: string; itemId?: string }>;
  updatePendingReport: (
    reportId: string,
    patch: PendingReportPatch,
  ) => Promise<{ ok: boolean; message: string }>;
  resolveReport: (
    reportId: string,
    status: Extract<ReportStatus, 'resolved' | 'unavailable'>,
    overrides?: PendingReportPatch,
  ) => Promise<{ ok: boolean; message: string }>;
  updateHomeLostItem: (
    itemId: string,
    patch: Partial<PublishedLostItem>,
  ) => Promise<{ ok: boolean; message: string }>;
  removeHomeLostItem: (
    itemId: string,
  ) => Promise<{ ok: boolean; message: string }>;
  issuePickupPass: (
    payload: PickupIssuePayload,
  ) => Promise<{
    ok: boolean;
    message: string;
    token?: string;
    pass?: PickupPass;
  }>;
  verifyPickupPass: (token: string) => Promise<PickupVerifyResult>;
  deleteReport: (reportId: string) => Promise<{ ok: boolean; message: string }>;
  refreshNotices: () => Promise<void>;
  refreshReports: () => Promise<void>;
  refreshReportsList: () => Promise<void>;
  refreshHomeCatalog: () => Promise<void>;
  refreshPickupPasses: () => Promise<void>;
  markNoticeRead: (
    noticeId: string,
  ) => Promise<{ ok: boolean; message: string }>;
  markAllNoticesRead: () => Promise<{ ok: boolean; message: string }>;
  deleteNotice: (noticeId: string) => Promise<{ ok: boolean; message: string }>;
  deleteAllNotices: () => Promise<{ ok: boolean; message: string }>;
};

const DandiStateContext = createContext<DandiStateContextValue | null>(null);
const API_BASE_URL = getApiBaseUrl();
/** 신고 캐시는 계정별로 분리한다 (같은 브라우저에서 계정을 바꿔도 섞이지 않게) */
function reportsLocalKey(): string | null {
  const email = getAuthSession()?.email;
  return email ? `dandi.reports.local:${email.toLowerCase()}` : null;
}
const SYNC_CHANNEL = 'dandi-sync';

function imageForReportStorage(image?: string): string | undefined {
  if (!image?.trim()) return undefined;
  if (image.startsWith('data:')) {
    return image.length <= 700_000 ? image : undefined;
  }
  return imageForLocalStorage(image) ?? image;
}

function persistReportsLocal(reports: LostReport[]) {
  if (typeof window === 'undefined') return;
  const slim = reports.slice(0, 120).map((r) => ({
    ...r,
    image: imageForReportStorage(r.image),
  }));
  const key = reportsLocalKey();
  if (key) safeSetLocalStorage(key, JSON.stringify(slim));
}

function loadReportsLocal(): LostReport[] {
  const key = typeof window === 'undefined' ? null : reportsLocalKey();
  if (!key) return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LostReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let syncChannel: BroadcastChannel | null = null;

function getSyncChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  syncChannel ??= new BroadcastChannel(SYNC_CHANNEL);
  return syncChannel;
}

/**
 * 다른 탭에만 신고 변경을 알린다. 같은 채널 인스턴스로 보내면 자기 탭에는 전달되지 않는다
 * — 현재 탭은 이미 직접 재조회하므로 신고 목록(대용량)을 한 번 더 받지 않게 한다.
 */
function notifyReportsChanged() {
  getSyncChannel()?.postMessage({ type: 'reports' });
}

/** 승인 직후 임시 카드처럼 서버 물품 ID를 아직 모를 때 — 로컬만 바꾸고 성공으로 보이지 않게 한다 */
const NOT_SYNCED_RESULT = {
  ok: false,
  message: '서버 물품 정보를 아직 받지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류';
}

function isTimeoutMessage(message: string): boolean {
  return /시간이 초과|timeout|aborted/i.test(message);
}

/** 검수 수정 폼 값 → 백엔드 PATCH /api/reports/{id} 본문 */
function toReportPatchPayload(patch: PendingReportPatch): ReportPatchPayload {
  const payload: ReportPatchPayload = {};
  if (patch.itemName != null) payload.itemName = patch.itemName;
  if (patch.category != null) payload.category = patch.category;
  if (patch.location != null) payload.location = sanitizeLocation(patch.location);
  if (patch.storage != null) payload.storage = sanitizeLocation(patch.storage);
  if (patch.memo != null) payload.memo = patch.memo;
  if (patch.lostAt != null) payload.lostAt = toApiDateTime(patch.lostAt);
  if (patch.image) Object.assign(payload, apiImageFields(patch.image));
  if (patch.image?.startsWith('data:')) payload.image = patch.image;
  return payload;
}

/** 백엔드 수령 QR 응답(발급·내 목록) → PickupPass */
function mapPickupPass(raw: Record<string, unknown>): PickupPass | null {
  const token = raw.token != null ? String(raw.token) : '';
  const lostItemId = raw.lostItemId != null ? String(raw.lostItemId) : '';
  if (!token || !lostItemId) return null;
  return {
    id: String(raw.id ?? token),
    lostItemId,
    reportId: raw.reportId != null ? String(raw.reportId) : undefined,
    itemName: raw.itemName != null ? String(raw.itemName) : undefined,
    itemLocation: raw.itemLocation != null ? String(raw.itemLocation) : undefined,
    claimantEmail: raw.claimantEmail != null ? String(raw.claimantEmail) : undefined,
    token,
    issuedAt: String(raw.issuedAt ?? ''),
    expiresAt: String(raw.expiresAt ?? ''),
    usedAt: raw.usedAt != null ? String(raw.usedAt) : null,
  };
}

function nowISO() {
  return new Date().toISOString();
}

function shortDateTime() {
  return koreanDateTime(new Date());
}

function normalizeNotice(raw: Record<string, unknown>): UserNotice | null {
  const id = raw.id ?? raw.noticeId;
  if (id == null) return null;
  return {
    id: String(id),
    title: String(raw.title ?? '알림'),
    message: String(raw.message ?? raw.body ?? raw.content ?? ''),
    createdAt:
      formatDateTimeLabel(String(raw.createdAt ?? raw.sentAt ?? '')) ||
      shortDateTime(),
    read: Boolean(raw.read ?? raw.isRead ?? false),
  };
}

function extractNoticeList(payload: unknown): UserNotice[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? ((
          payload as {
            content?: unknown[];
            data?: unknown[];
            items?: unknown[];
          }
        ).content ??
        (payload as { data?: unknown[] }).data ??
        (payload as { items?: unknown[] }).items ??
        [])
      : [];
  return list
    .map((row) => normalizeNotice(row as Record<string, unknown>))
    .filter((row): row is UserNotice => row !== null);
}

export function normalizeReport(raw: Record<string, unknown>): LostReport | null {
  const id = raw.id ?? raw.reportId;
  const itemName = raw.itemName ?? raw.name;
  if (id == null || itemName == null) return null;
  const status = normalizeReportStatus(raw.status);
  return {
    id: String(id),
    itemName: String(itemName),
    category: String(raw.category ?? '기타'),
    lostAt: formatDateTimeLabel(String(raw.lostAt ?? raw.foundAt ?? '')),
    location: sanitizeLocation(String(raw.location ?? raw.place ?? '')),
    memo: raw.memo != null ? String(raw.memo) : undefined,
    image: pickImageFromRaw(raw),
    itemType:
      raw.itemType != null
        ? String(raw.itemType)
        : raw.type != null
          ? String(raw.type)
          : undefined,
    storage: raw.storage != null ? String(raw.storage) : undefined,
    status,
    createdAt:
      formatDateTimeLabel(String(raw.createdAt ?? '')) || shortDateTime(),
    pickedUpAt:
      raw.pickedUpAt != null
        ? formatDateTimeLabel(String(raw.pickedUpAt)) || String(raw.pickedUpAt)
        : undefined,
    ownerEmail:
      raw.ownerEmail != null
        ? String(raw.ownerEmail)
        : raw.reporterEmail != null
          ? String(raw.reporterEmail)
          : raw.userEmail != null
            ? String(raw.userEmail)
            : raw.email != null
              ? String(raw.email)
              : undefined,
    ownerName:
      raw.ownerName != null
        ? String(raw.ownerName)
        : raw.reporterName != null
          ? String(raw.reporterName)
          : raw.userName != null
            ? String(raw.userName)
            : raw.claimantName != null
              ? String(raw.claimantName)
              : undefined,
  };
}

function extractReportList(payload: unknown): LostReport[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? ((
          payload as {
            content?: unknown[];
            data?: unknown[];
            items?: unknown[];
          }
        ).content ??
        (payload as { data?: unknown[] }).data ??
        (payload as { items?: unknown[] }).items ??
        [])
      : [];
  return list
    .map((row) => normalizeReport(row as Record<string, unknown>))
    .filter((row): row is LostReport => row !== null);
}

async function publishAdminLostItemToApi(
  payload: Omit<LostReport, 'id' | 'status' | 'createdAt'>,
  imageSource?: string | null,
): Promise<
  { id?: string; lostItemId?: string; reportId?: string; message?: string } & Record<
    string,
    unknown
  >
> {
  const foundAtIso = toApiDateTime(payload.lostAt);
  const createdAtIso = nowISO();
  const image = imageSource ?? payload.image;
  let linkedReportId: string | undefined;

  try {
    const reportData = await postReportCreate(
      {
        itemName: payload.itemName,
        category: payload.category,
        location: payload.location,
        place: payload.location,
        storage: payload.storage,
        memo: payload.memo,
        lostAt: foundAtIso,
        foundAt: foundAtIso,
      },
      image,
    );
    const rid = String(reportData.id ?? reportData.reportId ?? reportData.report_id ?? '').trim();
    if (/^\d+$/.test(rid)) {
      linkedReportId = rid;
      try {
        await patchReportStatus(rid, 'resolved');
      } catch {
        // lost_item 등록 시 reportId만 연결해도 됨
      }
    }
  } catch {
    // 신고 생성 실패 시 분실물만 등록
  }

  const data = await postLostItemCreate(
    {
      reportId: linkedReportId,
      name: payload.itemName,
      itemName: payload.itemName,
      category: payload.category,
      location: payload.location,
      place: payload.location,
      lostAt: foundAtIso,
      foundAt: foundAtIso,
      acquiredAt: foundAtIso,
      createdAt: createdAtIso,
      registeredAt: createdAtIso,
      memo: payload.memo,
      itemType: payload.itemType,
      storage: payload.storage,
      status: 'published',
    },
    image,
  );
  const rawReportId = data.reportId ?? data.report_id ?? linkedReportId;
  return {
    ...data,
    reportId:
      rawReportId != null && String(rawReportId).trim()
        ? String(rawReportId).trim()
        : linkedReportId,
  };
}

function normalizePendingPatch(patch: PendingReportPatch): PendingReportPatch {
  const next: PendingReportPatch = { ...patch };
  if (next.location != null) next.location = sanitizeLocation(next.location);
  if (next.storage != null) next.storage = sanitizeLocation(next.storage);
  if (next.lostAt != null)
    next.lostAt = formatDateTimeLabel(next.lostAt) || next.lostAt;
  if (next.image != null)
    next.image = resolveDisplayImageUrl(next.image) ?? next.image;
  return next;
}

export function DandiStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [reports, setReports] = useState<LostReport[]>(() =>
    loadReportsLocal(),
  );
  const [homeLostItems, setHomeLostItems] = useState<PublishedLostItem[]>([]);
  const reportsRef = useRef(reports);
  const homeLostItemsRef = useRef(homeLostItems);
  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);
  useEffect(() => {
    homeLostItemsRef.current = homeLostItems;
  }, [homeLostItems]);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [notices, setNotices] = useState<UserNotice[]>(() => getStoredLocalNotices());
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [noticesError, setNoticesError] = useState<string | null>(null);

  // 로컬 알림(n- prefix)은 새로고침/세션 사이에 유지되도록 localStorage에 백업합니다.
  useEffect(() => {
    const localOnly = notices.filter((it) => it.id.startsWith('n-'));
    setStoredLocalNotices(localOnly);
  }, [notices]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([
    {
      id: 'a-1001',
      message: '관리자 대시보드가 초기화되었습니다.',
      createdAt: shortDateTime(),
    },
  ]);
  // 수령 QR은 서버(GET /api/pickup-passes/me)가 기준 — 계정별로 다시 불러온다
  const [pickupPasses, setPickupPasses] = useState<PickupPass[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const runCompact = () => compactDandiLocalStorage();
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(runCompact, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(runCompact, 1200);
    return () => clearTimeout(timer);
  }, []);

  /** 수령 인증 후 DB RECEIVED 유지 — DELETE·로컬 삭제 없음 */
  const markLostItemReceivedAfterPickup = useCallback(
    (lostItemId: string, usedAt?: string) => {
      if (!lostItemId) return;
      const hint = String(lostItemId);
      const pools = [...homeLostItemsRef.current, ...getPublishedLostItems()];
      const target = findCatalogItemByHint(hint, pools);
      if (!target) return;

      const receivedLabel = usedAt
        ? formatDateTimeLabel(usedAt) || usedAt
        : shortDateTime();
      const updated: PublishedLostItem = {
        ...target,
        catalogStatus: 'RECEIVED',
        pickedUpAt: receivedLabel,
      };

      rememberCatalogStatus(target.id, 'RECEIVED', receivedLabel);
      if (target.reportId) rememberCatalogStatus(reportMetaKey(target.reportId), 'RECEIVED', receivedLabel);

      upsertPublishedLostItem(updated);
      setHomeLostItems((prev) =>
        prev.map((it) => (isSameCatalogItem(it, updated) ? updated : it)),
      );
      setCatalogVersion((v) => v + 1);
      invalidateRemoteLostItemsCache();
    },
    [],
  );

  /** 서버 목록을 기준으로 홈 카탈로그를 만든다. 로컬은 사진·시각 보강과 서버에 아직 없는 임시 카드에만 쓴다. */
  const applyCatalogMerge = useCallback(
    (reportList: LostReport[], remoteItems: PublishedLostItem[]) => {
      const collected: PublishedLostItem[] = [];
      const localPools = [
        ...homeLostItemsRef.current,
        ...getPublishedLostItems(),
      ];

      remoteItems
        .filter((item) => {
          if (isLostItemMarkedDeleted(item)) return false;
          if (!item.reportId) return true;
          const linked = reportList.find(
            (r) => String(r.id) === String(item.reportId),
          );
          return !linked || linked.status !== 'pending';
        })
        .forEach((item) => {
          const existing = localPools.find((local) =>
            isSameCatalogItem(local, item),
          );
          const merged = existing ? mergePublishedItems(item, existing) : item;
          collected.push({
            ...merged,
            // 상태는 서버 값이 기준
            catalogStatus: item.catalogStatus ?? merged.catalogStatus,
            image:
              resolveDisplayImageUrl(merged.image) ??
              resolveItemImageUrl(merged.image) ??
              merged.image,
          });
        });

      // 서버 PK가 있는 로컬 항목이 서버 목록에 없으면 이미 삭제된 것 — 임시 카드만 남긴다
      getPublishedLostItems().forEach((item) => {
        if (isLostItemMarkedDeleted(item) || lostItemPk(item)) return;
        if (remoteItems.some((remote) => isSameCatalogItem(remote, item))) return;
        collected.push({
          ...item,
          image:
            resolveDisplayImageUrl(item.image) ??
            resolveItemImageUrl(item.image) ??
            item.image,
        });
      });

      const linkedReportIds = new Set(
        collected
          .map((item) => item.reportId)
          .filter(Boolean)
          .map(String),
      );

      reportList
        .filter(
          (r) =>
            r.status === 'resolved' &&
            !linkedReportIds.has(String(r.id)),
        )
        .map((r) => reportToPublishedItem(r))
        .filter(
          (item) =>
            !isLostItemMarkedDeleted(item) && Boolean(item.name?.trim()),
        )
        .forEach((item) => collected.push(item));

      const next = sortLostItemsNewestFirst(
        enrichPublishedItemsWithReports(
          finalizeCatalogItems(collected),
          reportList,
        ),
      ).filter(
        (item) => !isLostItemMarkedDeleted(item) && Boolean(item.name?.trim()),
      );
      setHomeLostItems(next);
      setCatalogVersion((v) => v + 1);
    },
    [],
  );

  const catalogRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reportsSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const refreshHomeCatalogInner = useCallback(
    async (options?: { blocking?: boolean }) => {
      if (!API_BASE_URL || !getAuthSession()?.accessToken) return;
      const blocking = options?.blocking !== false;
      if (blocking) setCatalogLoading(true);
      try {
        const remoteItems = await fetchRemoteLostItems();
        setCatalogError(null);
        setReports((current) => {
          applyCatalogMerge(current, remoteItems);
          return current;
        });
      } catch (error) {
        // 실패를 빈 목록으로 바꾸지 않는다 — 기존 목록을 유지하고 오류를 알린다
        setCatalogError(
          `분실물 목록을 불러오지 못했습니다. (${errorMessage(error)})`,
        );
      } finally {
        setCatalogLoaded(true);
        if (blocking) setCatalogLoading(false);
      }
    },
    [applyCatalogMerge],
  );

  const scheduleHomeCatalogRefresh = useCallback(() => {
    if (catalogRefreshTimerRef.current)
      clearTimeout(catalogRefreshTimerRef.current);
    catalogRefreshTimerRef.current = setTimeout(() => {
      catalogRefreshTimerRef.current = null;
      void refreshHomeCatalogInner({ blocking: false });
    }, 450);
  }, [refreshHomeCatalogInner]);

  const refreshHomeCatalog = useCallback(async () => {
    if (catalogRefreshTimerRef.current) {
      clearTimeout(catalogRefreshTimerRef.current);
      catalogRefreshTimerRef.current = null;
    }
    await refreshHomeCatalogInner();
  }, [refreshHomeCatalogInner]);

  const replaceReportLocal = useCallback((updated: LostReport) => {
    setReports((prev) => {
      const next = prev.map((report) =>
        String(report.id) === String(updated.id) ? updated : report,
      );
      persistReportsLocal(next);
      return next;
    });
  }, []);

  /** 서버 신고 목록이 기준. 서버 ID가 아닌 로컬 임시 신고만 덧붙인다. */
  const refreshReportsList = useCallback(async () => {
    const email = getAuthSession()?.email;
    if (!API_BASE_URL || !email) return;
    try {
      const remote = extractReportList(
        await apiJson<unknown>('/api/reports', { method: 'GET' }),
      );
      if (getAuthSession()?.email !== email) return; // 요청 중 계정이 바뀜
      setReports((prev) => {
        const remoteIds = new Set(remote.map((r) => String(r.id)));
        const localOnly = prev.filter(
          (r) => !/^\d+$/.test(String(r.id)) && !remoteIds.has(String(r.id)),
        );
        // 표시용 라벨("2026. 10. 10. …")은 문자열 비교로 정렬되지 않는다 — 시각으로 비교
        const next = [...localOnly, ...remote].sort(
          (a, b) => parseDateTimeMs(b.createdAt) - parseDateTimeMs(a.createdAt),
        );
        persistReportsLocal(next);
        return next;
      });
    } catch {
      // 조회 실패 시 기존 목록 유지 (빈 목록으로 덮지 않음)
    }
  }, []);

  const refreshPickupPasses = useCallback(async () => {
    const email = getAuthSession()?.email;
    if (!API_BASE_URL || !email) return;
    try {
      const data = await apiJson<unknown>('/api/pickup-passes/me', { method: 'GET' });
      if (getAuthSession()?.email !== email) return;
      const rows = Array.isArray(data) ? data : [];
      const remote = rows
        .map((row) => mapPickupPass(row as Record<string, unknown>))
        .filter((row): row is PickupPass => row !== null);
      setPickupPasses((prev) =>
        remote.map((pass) => {
          const local = prev.find((it) => it.id === pass.id);
          return local ? { ...local, ...pass } : pass;
        }),
      );
    } catch {
      // 기존 목록 유지
    }
  }, []);

  const refreshReports = useCallback(async () => {
    await refreshReportsList();
    await refreshHomeCatalogInner();
  }, [refreshHomeCatalogInner, refreshReportsList]);

  const scheduleReportsSync = useCallback(() => {
    if (reportsSyncTimerRef.current) clearTimeout(reportsSyncTimerRef.current);
    reportsSyncTimerRef.current = setTimeout(() => {
      reportsSyncTimerRef.current = null;
      void refreshReportsList();
      scheduleHomeCatalogRefresh();
    }, 500);
  }, [refreshReportsList, scheduleHomeCatalogRefresh]);

  const appendLocalNotice = useCallback((title: string, message: string) => {
    const notice: UserNotice = {
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      createdAt: shortDateTime(),
      read: false,
    };
    setNotices((prev) => [notice, ...prev.filter((it) => it.id !== notice.id)]);
  }, []);

  const refreshNotices = useCallback(async () => {
    const email = getAuthSession()?.email;
    if (!API_BASE_URL || !email) return;
    setNoticesLoading(true);
    setNoticesError(null);
    try {
      const data = await apiJson<unknown>('/api/notices', { method: 'GET' });
      if (getAuthSession()?.email !== email) return; // 요청 중 계정이 바뀜
      const remote = extractNoticeList(data);
      setNotices((prev) => {
        const localOnly = prev.filter((it) => it.id.startsWith('n-'));
        const merged = [...remote, ...localOnly];
        const dedup = new Map<string, UserNotice>();
        merged.forEach((notice) => {
          if (!dedup.has(notice.id)) dedup.set(notice.id, notice);
        });
        return Array.from(dedup.values());
      });
    } catch (error) {
      setNoticesError(
        error instanceof Error
          ? error.message
          : '알림 목록을 불러오지 못했습니다.',
      );
    } finally {
      setNoticesLoading(false);
    }
  }, []);

  const sessionEmailRef = useRef<string | undefined>(undefined);

  const bootstrapAfterAuth = useCallback(async () => {
    const session = getAuthSession();
    const email = session?.accessToken ? session.email : undefined;
    if (email !== sessionEmailRef.current) {
      // 로그아웃 또는 다른 계정 로그인 — 이전 사용자의 개인 상태를 비운다
      sessionEmailRef.current = email;
      setReports(email ? loadReportsLocal() : []);
      setPickupPasses([]);
      setNotices(email ? getStoredLocalNotices() : []);
      setNoticesError(null);
      setAdminAuditLogs([]);
    }
    if (!email) return;
    void refreshNotices();
    void refreshHomeCatalogInner({ blocking: false });
    void refreshReportsList();
    void refreshPickupPasses();
  }, [refreshHomeCatalogInner, refreshNotices, refreshPickupPasses, refreshReportsList]);

  useEffect(() => {
    void bootstrapAfterAuth();
    const onAuthChanged = () => {
      void bootstrapAfterAuth();
    };
    window.addEventListener('dandi-auth-changed', onAuthChanged);
    return () =>
      window.removeEventListener('dandi-auth-changed', onAuthChanged);
  }, [bootstrapAfterAuth]);

  useEffect(() => {
    const syncReportsDebounced = () => {
      if (getAuthSession()?.accessToken) scheduleReportsSync();
    };

    const channel = getSyncChannel();
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'reports') syncReportsDebounced();
    };
    channel?.addEventListener('message', onMessage);

    return () => {
      channel?.removeEventListener('message', onMessage);
      if (catalogRefreshTimerRef.current)
        clearTimeout(catalogRefreshTimerRef.current);
      if (reportsSyncTimerRef.current)
        clearTimeout(reportsSyncTimerRef.current);
    };
  }, [scheduleReportsSync]);

  const value = useMemo<DandiStateContextValue>(
    () => ({
      reports,
      homeLostItems,
      catalogVersion,
      catalogLoading,
      catalogLoaded,
      catalogError,
      notices,
      noticesLoading,
      noticesError,
      apiConfigured: Boolean(API_BASE_URL),
      apiBaseUrl: API_BASE_URL,
      adminAuditLogs,
      pickupPasses,
      submitReport: async (payload) => {
        const session = getAuthSession();
        const ownerEmail = session?.email;
        const ownerName =
          session?.name?.trim() ||
          extractStudentIdFromEmail(session?.email) ||
          undefined;
        const lostAtDisplay =
          formatDateTimeLabel(payload.lostAt) || payload.lostAt;
        const lostAtIso = toApiDateTime(payload.lostAt);
        const displayImage =
          resolveDisplayImageUrl(payload.image) ?? payload.image?.trim();
        const normalizedPayload = {
          ...payload,
          location: sanitizeLocation(payload.location),
          lostAt: lostAtDisplay,
          storage: payload.storage
            ? sanitizeLocation(payload.storage)
            : payload.storage,
          image: displayImage,
        };
        try {
          const data = await postReportCreate(
            {
              itemName: normalizedPayload.itemName,
              category: normalizedPayload.category,
              location: normalizedPayload.location,
              place: normalizedPayload.location,
              storage: normalizedPayload.storage,
              memo: normalizedPayload.memo,
              lostAt: lostAtIso,
              foundAt: lostAtIso,
              // 신고자 이름은 보내지 않는다 — 서버가 메모에 붙여 공개 설명으로 노출하던 문제
              ownerEmail,
              reporterEmail: ownerEmail,
            },
            payload.image,
          );
          const reportId = String(
            data.id ?? data.reportId ?? data.report_id ?? `r-${Date.now()}`,
          );
          const report: LostReport = {
            id: reportId,
            ...normalizedPayload,
            image: pickImageFromRaw(data) ?? displayImage ?? undefined,
            status: normalizeReportStatus(data.status),
            createdAt:
              formatDateTimeLabel(String(data.createdAt ?? '')) ||
              shortDateTime(),
            ownerEmail,
            ownerName,
          };
          setReports((prev) => {
            const next = [
              report,
              ...prev.filter((it) => String(it.id) !== reportId),
            ];
            persistReportsLocal(next);
            return next;
          });
          // 서버가 접수 알림을 만든다 — 로컬 알림을 또 만들면 알림함에 두 번 보인다
          if (!API_BASE_URL) {
            appendLocalNotice(
              '분실물 신고 접수',
              `${report.itemName} 신고가 접수되어 검수 대기에 등록되었습니다.`,
            );
          }
          void refreshNotices();
          void refreshReportsList();
          return {
            ok: true,
            message: data.message
              ? String(data.message)
              : '신고가 접수되었습니다.',
            reportId,
          };
        } catch (error) {
          if (API_BASE_URL) {
            try {
              const remote = extractReportList(
                await apiJson<unknown>('/api/reports', { method: 'GET' }),
              );
              const matched = remote.find(
                (r) =>
                  r.itemName === payload.itemName &&
                  r.location === sanitizeLocation(payload.location) &&
                  r.status === 'pending' &&
                  r.ownerEmail === ownerEmail,
              );
              if (matched) {
                setReports((prev) => {
                  const next = [
                    matched,
                    ...prev.filter((it) => String(it.id) !== matched.id),
                  ];
                  persistReportsLocal(next);
                  return next;
                });
                void refreshNotices();
                void refreshReportsList();
                return {
                  ok: true,
                  message:
                    '신고가 접수되었습니다. (서버 응답 형식이 달라 목록을 다시 불러왔습니다.)',
                  reportId: matched.id,
                };
              }
            } catch {
              // ignore recovery attempt
            }
          }
          return {
            ok: false,
            message:
              error instanceof Error
                ? `신고 접수에 실패했습니다. (${error.message})`
                : '신고 접수에 실패했습니다.',
          };
        }
      },
      publishAdminLostItem: async (payload) => {
        const lostAtDisplay =
          formatDateTimeLabel(payload.lostAt) || payload.lostAt;
        const createdAtDisplay = shortDateTime();
        const displayImage =
          resolveDisplayImageUrl(payload.image) ?? payload.image?.trim();
        const normalizedPayload = {
          ...payload,
          location: sanitizeLocation(payload.location),
          lostAt: lostAtDisplay,
          storage: payload.storage
            ? sanitizeLocation(payload.storage)
            : payload.storage,
          image: displayImage,
        };

        const buildLocalItem = (id: string): PublishedLostItem => ({
          id,
          name: normalizedPayload.itemName,
          category: normalizedPayload.category,
          type: normalizedPayload.itemType,
          memo: normalizedPayload.memo,
          place: normalizedPayload.location,
          storage: normalizedPayload.storage,
          time: lostAtDisplay || createdAtDisplay,
          foundAt: lostAtDisplay,
          createdAt: createdAtDisplay,
          image: normalizedPayload.image,
        });

        if (API_BASE_URL && getAuthSession()?.accessToken) {
          try {
            const data = await publishAdminLostItemToApi(
              normalizedPayload,
              payload.image,
            );
            const itemId = String(
              data.id ?? data.lostItemId ?? `adm-${Date.now()}`,
            );
            let mapped =
              mapApiLostItem({
                ...data,
                id: itemId,
                ...normalizedPayload,
                itemName: normalizedPayload.itemName,
              }) ?? buildLocalItem(itemId);
            const linkedReport =
              data.reportId != null
                ? String(data.reportId)
                : data.report_id != null
                  ? String(data.report_id)
                  : undefined;
            mapped = {
              ...mapped,
              createdAt: mapped.createdAt ?? createdAtDisplay,
              reportId: mapped.reportId ?? linkedReport,
              catalogStatus: pickRicherCatalogStatus(mapped.catalogStatus, 'ACQUIRED'),
              image:
                resolveDisplayImageUrl(mapped.image) ??
                resolveItemImageUrl(mapped.image) ??
                displayImage,
            };
            rememberCatalogStatus(itemId, mapped.catalogStatus ?? 'ACQUIRED');
            const regIso = toApiDateTime(createdAtDisplay);
            const foundIso = toApiDateTime(lostAtDisplay);
            rememberItemTimes(itemId, { createdAt: regIso, foundAt: foundIso });
            if (mapped.reportId)
              rememberItemTimes(reportMetaKey(mapped.reportId), {
                createdAt: regIso,
                foundAt: foundIso,
              });
            rememberItemImage(itemId, mapped.image ?? displayImage);
            if (mapped.reportId)
              rememberItemImage(reportMetaKey(mapped.reportId), mapped.image ?? displayImage);
            upsertPublishedLostItem(mapped);
            setHomeLostItems((prev) =>
              sortLostItemsNewestFirst(
                dedupePublishedCatalog([
                  mapped,
                  ...prev.filter((it) => !isSameCatalogItem(it, mapped)),
                ]),
              ),
            );
            setCatalogVersion((v) => v + 1);
            invalidateRemoteLostItemsCache();
            if (typeof window !== 'undefined') {
              window.setTimeout(() => scheduleHomeCatalogRefresh(), 4000);
            }
            setAdminAuditLogs((prev) => [
              {
                id: `a-${Date.now()}`,
                message: `관리자 직접 등록: ${normalizedPayload.itemName} (홈 즉시 노출)`,
                createdAt: shortDateTime(),
              },
              ...prev,
            ]);
            return {
              ok: true,
              message: '홈·검색에 바로 등록되었습니다.',
              itemId,
            };
          } catch (error) {
            return {
              ok: false,
              message:
                error instanceof Error
                  ? `등록에 실패했습니다. (${error.message})`
                  : '등록에 실패했습니다.',
            };
          }
        }

        const localId = `adm-${Date.now()}`;
        const localItem = buildLocalItem(localId);
        upsertPublishedLostItem(localItem);
        setHomeLostItems((prev) =>
          sortLostItemsNewestFirst([localItem, ...prev]),
        );
        setCatalogVersion((v) => v + 1);
        return {
          ok: true,
          message: '홈·검색에 바로 등록되었습니다.',
          itemId: localId,
        };
      },
      updatePendingReport: async (reportId, patch) => {
        const normalizedId = String(reportId);
        const normalizedPatch = normalizePendingPatch(patch);
        const sourceReport = reportsRef.current.find(
          (report) => String(report.id) === normalizedId,
        );
        if (!sourceReport) {
          return {
            ok: false,
            message: '해당 신고를 찾을 수 없습니다. 목록을 새로고침해 주세요.',
          };
        }
        if (sourceReport.status !== 'pending') {
          return {
            ok: false,
            message: '검수 대기 중인 신고만 수정할 수 있습니다.',
          };
        }

        let updated: LostReport = { ...sourceReport, ...normalizedPatch };
        if (API_BASE_URL) {
          try {
            const saved = await patchReportDetails(
              normalizedId,
              toReportPatchPayload(patch),
            );
            updated = normalizeReport(saved) ?? updated;
          } catch (error) {
            return {
              ok: false,
              message: `검수 내용 저장에 실패했습니다. (${errorMessage(error)})`,
            };
          }
        }

        replaceReportLocal(updated);
        notifyReportsChanged();
        return {
          ok: true,
          message: API_BASE_URL
            ? '검수 내용이 서버에 저장되었습니다.'
            : '검수 내용이 저장되었습니다. (API 미연동)',
        };
      },
      resolveReport: async (reportId, status, overrides) => {
        const normalizedId = String(reportId);
        const sourceReport = reportsRef.current.find(
          (report) => String(report.id) === normalizedId,
        );
        if (!sourceReport) {
          return {
            ok: false,
            message: '해당 신고를 찾을 수 없습니다. 목록을 새로고침해 주세요.',
          };
        }

        let resolvedReport: LostReport = {
          ...sourceReport,
          ...(overrides ? normalizePendingPatch(overrides) : {}),
          status,
        };

        if (API_BASE_URL) {
          try {
            // 검수 수정 내용을 먼저 신고에 저장 → 승인 시 서버가 그 신고로 물품을 생성·갱신한다
            if (overrides && status === 'resolved') {
              const saved = await patchReportDetails(
                normalizedId,
                toReportPatchPayload(overrides),
              );
              resolvedReport = { ...(normalizeReport(saved) ?? resolvedReport), status };
            }
            await patchReportStatus(normalizedId, status);
          } catch (error) {
            const message = errorMessage(error);
            if (isTimeoutMessage(message)) {
              // 서버 처리 여부가 불명확 — 최신 상태를 다시 불러와 확인하게 한다
              void refreshReportsList();
              return {
                ok: false,
                message:
                  '서버 응답이 지연되었습니다. 목록을 다시 불러왔으니 상태를 확인한 뒤 필요하면 다시 시도해 주세요.',
              };
            }
            return { ok: false, message: `처리에 실패했습니다. (${message})` };
          }
        }

        replaceReportLocal(resolvedReport);
        setAdminAuditLogs((prev) => [
          {
            id: `a-${Date.now()}`,
            message: `${normalizedId} 신고건을 ${status === 'resolved' ? '습득 완료' : '습득 불가'}로 처리했습니다.`,
            createdAt: shortDateTime(),
          },
          ...prev,
        ]);

        if (API_BASE_URL) {
          invalidateRemoteLostItemsCache();
          await Promise.all([
            refreshReportsList(),
            refreshHomeCatalogInner({ blocking: false }),
          ]);
          notifyReportsChanged();
        } else if (status === 'resolved') {
          const published = reportToPublishedItem(resolvedReport);
          upsertPublishedLostItem(published);
          setHomeLostItems((prev) =>
            sortLostItemsNewestFirst(dedupePublishedCatalog([published, ...prev])),
          );
          setCatalogVersion((v) => v + 1);
        }

        return {
          ok: true,
          message:
            status === 'resolved'
              ? '습득 완료 처리되었습니다. 홈 목록에 공개되었습니다.'
              : '습득 불가 처리되었습니다.',
        };
      },
      updateHomeLostItem: async (itemId, patch) => {
        const normalizedId = String(itemId);
        const pools = [...homeLostItemsRef.current, ...getPublishedLostItems()];
        const target = findCatalogItemByHint(normalizedId, pools);
        if (!target) {
          return {
            ok: false,
            message:
              '수정할 물품을 찾을 수 없습니다. 목록을 새로고침해 주세요.',
          };
        }

        const foundAtLabel =
          patch.foundAt ?? patch.time ?? target.foundAt ?? target.time;
        const createdAtLabel = patch.createdAt ?? target.createdAt;
        const category = (patch.category ?? target.category)?.trim() || '기타';
        const detailType = patch.type?.trim() || category;

        const updated: PublishedLostItem = {
          ...target,
          ...patch,
          category,
          type: patch.type?.trim() || target.type,
          time:
            formatDateTimeLabel(foundAtLabel) || foundAtLabel || target.time,
          foundAt: formatDateTimeLabel(foundAtLabel) || foundAtLabel,
          createdAt: formatDateTimeLabel(createdAtLabel) || createdAtLabel,
        };

        const serverId = resolveServerLostItemId(target, normalizedId, pools);
        if (API_BASE_URL && !serverId) return NOT_SYNCED_RESULT;
        let saved: PublishedLostItem = updated;

        if (API_BASE_URL) {
          const patchBody: Record<string, string> = {
            itemName: updated.name,
            category,
            itemType: detailType,
            place: updated.place,
            location: updated.place,
            foundAt: toApiDateTime(updated.foundAt ?? updated.time),
          };
          if (updated.storage?.trim()) patchBody.storage = updated.storage.trim();
          if (updated.memo?.trim()) patchBody.memo = updated.memo.trim();
          Object.assign(patchBody, apiImageFields(updated.image));
          try {
            const data = await apiJson<Record<string, unknown>>(
              `/api/lost-items/${encodeURIComponent(serverId)}`,
              { method: 'PATCH', body: JSON.stringify(patchBody) },
              { timeoutMs: API_MUTATION_TIMEOUT_MS },
            );
            const mapped = mapApiLostItem({ ...data, id: data.id ?? serverId });
            saved = mapped ? mergePublishedItems(mapped, updated) : updated;
          } catch (error) {
            return {
              ok: false,
              message: `저장에 실패했습니다. (${errorMessage(error)})`,
            };
          }
        }

        upsertPublishedLostItem(saved);
        setHomeLostItems((prev) =>
          sortLostItemsNewestFirst(
            prev.map((it) => (isSameCatalogItem(it, saved) ? saved : it)),
          ),
        );
        setCatalogVersion((v) => v + 1);
        invalidateRemoteLostItemsCache();

        return {
          ok: true,
          message: API_BASE_URL
            ? '저장되었습니다.'
            : '로컬에 저장되었습니다. (API 미연동)',
        };
      },
      removeHomeLostItem: async (itemId) => {
        const normalizedId = String(itemId);
        const pools = [...homeLostItemsRef.current, ...getPublishedLostItems()];
        const target = findCatalogItemByHint(normalizedId, pools);
        if (!target) {
          return {
            ok: false,
            message: '삭제할 물품을 찾을 수 없습니다. 목록을 새로고침해 주세요.',
          };
        }
        const serverId = resolveServerLostItemId(target, normalizedId, pools);
        if (API_BASE_URL && !serverId) return NOT_SYNCED_RESULT;

        if (API_BASE_URL) {
          try {
            await apiJson<object>(
              `/api/lost-items/${encodeURIComponent(serverId)}`,
              { method: 'DELETE' },
              { timeoutMs: API_MUTATION_TIMEOUT_MS },
            );
          } catch (error) {
            return {
              ok: false,
              message: `삭제에 실패했습니다. (${errorMessage(error)})`,
            };
          }
        }

        markLostItemDeletedForTarget(target);
        removePublishedLostItemByTarget(target);
        clearLostItemOverridesForIds([target.id, serverId]);
        deleteCustomLostItem(target.id);
        setHomeLostItems((prev) => prev.filter((it) => !isSameCatalogItem(it, target)));
        if (target.reportId) {
          // 서버는 물품 삭제 시 연결 신고도 함께 삭제한다
          const linkedReportId = String(target.reportId);
          setReports((prev) => {
            const next = prev.filter((r) => String(r.id) !== linkedReportId);
            persistReportsLocal(next);
            return next;
          });
        }
        setCatalogVersion((v) => v + 1);
        invalidateRemoteLostItemsCache();
        if (API_BASE_URL) notifyReportsChanged();

        return {
          ok: true,
          message: '물품이 삭제되어 홈·검색에서 제외되었습니다.',
        };
      },
      issuePickupPass: async (payload) => {
        const lostItemId = String(payload?.lostItemId ?? '').trim();
        if (!/^\d+$/.test(lostItemId)) {
          return {
            ok: false,
            message: '서버에 등록된 물품만 수령 QR을 발급할 수 있습니다.',
          };
        }

        try {
          const data = await apiJson<Record<string, unknown>>('/api/pickup-passes', {
            method: 'POST',
            body: JSON.stringify({ lostItemId }),
          });
          const pass = mapPickupPass({
            ...data,
            itemName: payload.itemName,
            itemLocation: payload.itemLocation,
            claimantEmail: getAuthSession()?.email,
          });
          if (!pass) {
            return { ok: false, message: 'QR 발급 응답을 해석할 수 없습니다.' };
          }
          setPickupPasses((prev) => [
            { ...pass, itemImage: payload.itemImage, claimantName: getAuthSession()?.name },
            ...prev.filter((it) => it.id !== pass.id),
          ]);
          return {
            ok: true,
            message: String(data.message ?? '수령 QR이 발급되었습니다.'),
            token: pass.token,
            pass,
          };
        } catch (error) {
          return {
            ok: false,
            message: `QR 발급에 실패했습니다. (${errorMessage(error)})`,
          };
        }
      },
      verifyPickupPass: async (token) => {
        const normalized = normalizePickupToken(token);
        if (!normalized) {
          return { ok: false, message: 'QR 코드를 입력해 주세요.' };
        }
        if (!/^DKU-[A-Z0-9]{6,}$/.test(normalized)) {
          return {
            ok: false,
            message: '올바른 수령 코드 형식이 아닙니다. (DKU-로 시작)',
          };
        }

        const localPass = pickupPasses.find(
          (it) => it.token.toUpperCase() === normalized,
        );
        if (localPass?.usedAt) {
          return { ok: false, message: '이미 수령 인증이 완료된 코드입니다.' };
        }

        try {
          const data = await apiJson<{
            ok?: boolean;
            message?: string;
            lostItemId?: string;
            reportId?: string | null;
            requesterEmail?: string;
            usedAt?: string;
          }>(
            '/api/pickup-passes/verify',
            {
              method: 'POST',
              body: JSON.stringify({ token: normalized }),
            },
            { timeoutMs: API_MUTATION_TIMEOUT_MS },
          );

          if (data.ok === false) {
            return {
              ok: false,
              message: data.message ?? 'QR 인증에 실패했습니다.',
            };
          }

          const usedAt = data.usedAt ?? nowISO();
          const lostItemId = String(data.lostItemId ?? localPass?.lostItemId ?? '');
          const reportId = data.reportId ? String(data.reportId) : undefined;
          const pass: PickupPass = {
            id: localPass?.id ?? `p-${Date.now()}`,
            lostItemId,
            reportId,
            itemName: localPass?.itemName,
            itemImage: localPass?.itemImage,
            itemLocation: localPass?.itemLocation,
            claimantName: localPass?.claimantName,
            claimantEmail: data.requesterEmail ?? localPass?.claimantEmail,
            token: normalized,
            issuedAt: localPass?.issuedAt ?? usedAt,
            expiresAt: localPass?.expiresAt ?? usedAt,
            usedAt,
          };

          setPickupPasses((prev) =>
            prev.map((it) =>
              it.token.toUpperCase() === normalized ? { ...it, usedAt } : it,
            ),
          );
          if (reportId) {
            const pickedUpAt = formatDateTimeLabel(usedAt) || usedAt;
            setReports((prev) =>
              prev.map((report) =>
                String(report.id) === reportId
                  ? { ...report, status: 'picked_up', pickedUpAt }
                  : report,
              ),
            );
          }
          if (lostItemId) markLostItemReceivedAfterPickup(lostItemId, usedAt);
          invalidateRemoteLostItemsCache();
          scheduleHomeCatalogRefresh();
          void refreshReportsList();
          notifyReportsChanged();
          setAdminAuditLogs((prev) => [
            {
              id: `a-${Date.now()}`,
              message: `[${pass.itemName ?? '물품'}] QR 수령 인증 완료 — 인수자: ${pass.claimantEmail ?? '이메일 없음'}`,
              createdAt: formatDateTimeLabel(usedAt) || usedAt,
            },
            ...prev,
          ]);
          return {
            ok: true,
            message: data.message ?? 'QR 인증 완료: 최종 수령 처리되었습니다.',
            pass,
          };
        } catch (error) {
          const message = errorMessage(error);
          if (/403|권한|admin/i.test(message)) {
            return {
              ok: false,
              message:
                '관리자 권한이 필요합니다. 관리자 계정으로 로그인해 주세요.',
            };
          }
          if (/이미 수령 완료/.test(message)) {
            return { ok: false, message: '이미 수령 완료된 물품입니다.' };
          }
          if (/409|이미 사용|already/i.test(message)) {
            return { ok: false, message: '이미 사용된 수령 코드입니다.' };
          }
          if (/404|찾을 수 없|not found/i.test(message)) {
            return { ok: false, message: '유효하지 않은 QR 코드입니다.' };
          }
          if (/400|만료|expired/i.test(message)) {
            return { ok: false, message: '만료되었거나 잘못된 QR 코드입니다.' };
          }
          return { ok: false, message };
        }
      },
      deleteReport: async (reportId) => {
        const removeLocal = () => {
          setReports((prev) => {
            const next = prev.filter((report) => report.id !== reportId);
            persistReportsLocal(next);
            return next;
          });
          setAdminAuditLogs((prev) => [
            {
              id: `a-${Date.now()}`,
              message: `${reportId} 신고건이 삭제되었습니다.`,
              createdAt: shortDateTime(),
            },
            ...prev,
          ]);
        };

        // 서버에 없는 로컬 임시 신고는 백엔드 호출 없이 바로 삭제
        if (!API_BASE_URL || !/^\d+$/.test(reportId)) {
          removeLocal();
          return { ok: true, message: '신고 항목이 삭제되었습니다.' };
        }

        try {
          await apiJson<object>(
            `/api/reports/${encodeURIComponent(reportId)}`,
            { method: 'DELETE' },
            { timeoutMs: API_MUTATION_TIMEOUT_MS },
          );
        } catch (error) {
          return {
            ok: false,
            message: `신고 삭제에 실패했습니다. (${errorMessage(error)})`,
          };
        }
        removeLocal();
        // 서버는 연결된 물품도 함께 삭제한다
        invalidateRemoteLostItemsCache();
        scheduleHomeCatalogRefresh();
        notifyReportsChanged();
        return { ok: true, message: '신고 항목이 삭제되었습니다.' };
      },
      refreshNotices,
      refreshReports,
      refreshReportsList,
      refreshHomeCatalog,
      refreshPickupPasses,
      deleteNotice: async (noticeId) => {
        const target = notices.find((notice) => notice.id === noticeId);
        if (!target) {
          return { ok: false, message: '삭제할 알림을 찾을 수 없습니다.' };
        }

        if (API_BASE_URL && !noticeId.startsWith('n-')) {
          try {
            await apiJson<object>(
              `/api/notices/${encodeURIComponent(noticeId)}`,
              { method: 'DELETE' },
            );
          } catch (error) {
            return {
              ok: false,
              message: `알림 삭제에 실패했습니다. (${errorMessage(error)})`,
            };
          }
        }
        setNotices((prev) => prev.filter((notice) => notice.id !== noticeId));
        return { ok: true, message: '알림이 삭제되었습니다.' };
      },
      deleteAllNotices: async () => {
        if (API_BASE_URL) {
          try {
            await apiJson<object>('/api/notices', { method: 'DELETE' });
          } catch (error) {
            return {
              ok: false,
              message: `알림 삭제에 실패했습니다. (${errorMessage(error)})`,
            };
          }
        }
        setNotices([]);
        return { ok: true, message: '모든 알림을 삭제했습니다.' };
      },
      markNoticeRead: async (noticeId) => {
        const target = notices.find((notice) => notice.id === noticeId);
        if (!target) {
          return { ok: false, message: '대상 알림을 찾을 수 없습니다.' };
        }
        const setRead = (read: boolean) =>
          setNotices((prev) =>
            prev.map((notice) =>
              notice.id === noticeId ? { ...notice, read } : notice,
            ),
          );

        setRead(true);
        // 프론트 임시 알림(n- prefix)이거나 백엔드 미설정이면 로컬만 처리
        if (!API_BASE_URL || noticeId.startsWith('n-')) {
          return { ok: true, message: '읽음 처리되었습니다.' };
        }

        try {
          await apiJson<{ message?: string }>(`/api/notices/${noticeId}/read`, {
            method: 'PATCH',
          });
          return { ok: true, message: '읽음 처리되었습니다.' };
        } catch (error) {
          setRead(target.read);
          return {
            ok: false,
            message: `읽음 처리에 실패했습니다. (${errorMessage(error)})`,
          };
        }
      },
      markAllNoticesRead: async () => {
        const unreadIds = notices.filter((notice) => !notice.read).map((notice) => notice.id);
        if (unreadIds.length === 0) {
          return { ok: true, message: '읽지 않은 알림이 없습니다.' };
        }
        setNotices((prev) => prev.map((notice) => ({ ...notice, read: true })));

        // ponytail: 일괄 읽음 API가 없어 알림마다 PATCH, 알림이 많아지면 백엔드 일괄 API로 교체
        const remoteIds = API_BASE_URL ? unreadIds.filter((id) => !id.startsWith('n-')) : [];
        const results = await Promise.allSettled(
          remoteIds.map((id) =>
            apiJson<{ message?: string }>(`/api/notices/${encodeURIComponent(id)}/read`, {
              method: 'PATCH',
            }),
          ),
        );
        const failedIds = new Set(remoteIds.filter((_, idx) => results[idx].status === 'rejected'));
        if (failedIds.size === 0) {
          return { ok: true, message: '모든 알림을 읽음 처리했습니다.' };
        }
        setNotices((prev) =>
          prev.map((notice) => (failedIds.has(notice.id) ? { ...notice, read: false } : notice)),
        );
        return {
          ok: false,
          message: `알림 ${failedIds.size}건의 읽음 처리에 실패했습니다.`,
        };
      },
    }),
    [
      adminAuditLogs,
      appendLocalNotice,
      catalogError,
      catalogLoaded,
      catalogLoading,
      catalogVersion,
      homeLostItems,
      markLostItemReceivedAfterPickup,
      notices,
      noticesError,
      noticesLoading,
      pickupPasses,
      refreshHomeCatalog,
      refreshHomeCatalogInner,
      refreshNotices,
      refreshPickupPasses,
      refreshReports,
      refreshReportsList,
      replaceReportLocal,
      reports,
      scheduleHomeCatalogRefresh,
    ],
  );

  return (
    <DandiStateContext.Provider value={value}>
      {children}
    </DandiStateContext.Provider>
  );
}

export function useDandiState() {
  const context = useContext(DandiStateContext);
  if (!context) {
    throw new Error('useDandiState must be used within DandiStateProvider');
  }
  return context;
}

export async function fetchAIGuidance(payload: {
  name: string;
  category: string;
  type?: string;
}) {
  const response = await fetch('/api/ai-guidance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('AI 안내 생성 실패');
  return (await response.json()) as {
    cautionTitle: string;
    cautions: string[];
    chatbotTips: string[];
  };
}

export function toKST(iso: string) {
  return formatDateTimeLabel(iso) || iso;
}

export const RUNTIME_TIMESTAMP = nowISO();
