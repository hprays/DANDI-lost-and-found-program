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
  getDeletedLostItemIds,
  isLostItemMarkedDeleted,
  markLostItemDeleted,
  markLostItemDeletedForTarget,
} from '@/lib/custom-lost-items';
import {
  findCatalogItemByHint,
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
  removePublishedLostItem,
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
  rememberItemImage,
  rememberItemRegistrationTime,
  rememberItemTimes,
} from '@/lib/registration-meta';
import { postLostItemCreate, postReportCreate } from '@/lib/api-upload';
import {
  apiJson,
  API_MUTATION_TIMEOUT_MS,
  getApiBaseUrl,
  patchReportStatus,
} from '@/lib/api-json';
import {
  formatDateTimeLabel,
  normalizeReportStatus,
  pickRicherDateTimeLabel,
  sanitizeLocation,
  toApiDateTime,
} from '@/lib/format-display';
import { normalizePickupToken } from '@/lib/pickup-token';
import {
  apiImageFields,
  pickImageFromRaw,
  resolveDisplayImageUrl,
  resolveItemImageUrl,
  resolveMediaUrl,
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
  markNoticeRead: (
    noticeId: string,
  ) => Promise<{ ok: boolean; message: string }>;
  deleteNotice: (noticeId: string) => Promise<{ ok: boolean; message: string }>;
  deleteAllNotices: () => Promise<{ ok: boolean; message: string }>;
};

const DandiStateContext = createContext<DandiStateContextValue | null>(null);
const API_BASE_URL = getApiBaseUrl();
export const REPORTS_CHANGED_EVENT = 'dandi-reports-changed';
const PICKUP_PASSES_KEY = 'dandi.pickupPasses';
const REPORTS_LOCAL_KEY = 'dandi.reports.local';
const SYNC_CHANNEL = 'dandi-sync';

function reportStatusRank(status: ReportStatus): number {
  switch (status) {
    case 'picked_up':
      return 4;
    case 'resolved':
      return 3;
    case 'unavailable':
      return 2;
    case 'pending':
    default:
      return 1;
  }
}

/** 서버가 아직 pending 인데 로컬에서 습득완료한 경우 — 로컬 상태·수정 내용 유지 */
function mergeReportRecords(
  existing: LostReport,
  incoming: LostReport,
): LostReport {
  const keepExistingStatus =
    reportStatusRank(existing.status) >= reportStatusRank(incoming.status);
  const primary = keepExistingStatus ? existing : incoming;
  const secondary = keepExistingStatus ? incoming : existing;
  return {
    ...secondary,
    ...primary,
    status: keepExistingStatus ? existing.status : incoming.status,
    image:
      resolveDisplayImageUrl(primary.image) ??
      resolveDisplayImageUrl(secondary.image) ??
      primary.image ??
      secondary.image,
    ownerName: primary.ownerName ?? secondary.ownerName,
    ownerEmail: primary.ownerEmail ?? secondary.ownerEmail,
  };
}

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
  safeSetLocalStorage(REPORTS_LOCAL_KEY, JSON.stringify(slim));
}

function loadReportsLocal(): LostReport[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(REPORTS_LOCAL_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LostReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function notifyReportsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REPORTS_CHANGED_EVENT));
  try {
    new BroadcastChannel(SYNC_CHANNEL).postMessage({ type: 'reports' });
  } catch {
    // BroadcastChannel 미지원 환경
  }
}

function getStoredPickupPasses(): PickupPass[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(PICKUP_PASSES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PickupPass[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nowISO() {
  return new Date().toISOString();
}

function shortDateTime() {
  return new Date().toLocaleString('ko-KR', { hour12: false });
}

function minutesLaterISO(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function pickupToken() {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `DKU-${rand}`;
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

function normalizeReport(raw: Record<string, unknown>): LostReport | null {
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

async function publishLostItemToApi(
  report: LostReport,
  imageSource?: string | null,
): Promise<{ id?: string; lostItemId?: string } | void> {
  if (!API_BASE_URL) return;
  const foundAtIso = toApiDateTime(report.lostAt);
  const createdAtIso = nowISO();
  const image = imageSource ?? report.image;
  const linkedReportId = /^\d+$/.test(String(report.id))
    ? String(report.id)
    : undefined;
  const data = await postLostItemCreate(
    {
      reportId: linkedReportId,
      name: report.itemName,
      itemName: report.itemName,
      category: report.category,
      location: report.location,
      place: report.location,
      lostAt: foundAtIso,
      foundAt: foundAtIso,
      acquiredAt: foundAtIso,
      createdAt: createdAtIso,
      registeredAt: createdAtIso,
      memo: report.memo,
      itemType: report.itemType,
      storage: report.storage,
      status: 'published',
    },
    image,
  );
  return data;
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

  const [notices, setNotices] = useState<UserNotice[]>(() => {
    const stored = getStoredLocalNotices();
    if (stored.length > 0) return stored;
    return [
      {
        id: 'n-1001',
        title: '알림 설정이 활성화되었습니다',
        message: '관심 키워드와 일치하는 습득물이 등록되면 바로 알려드려요.',
        createdAt: shortDateTime(),
        read: false,
      },
    ];
  });
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
  const [pickupPasses, setPickupPasses] = useState<PickupPass[]>(() =>
    getStoredPickupPasses(),
  );

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

  useEffect(() => {
    safeSetLocalStorage(
      PICKUP_PASSES_KEY,
      JSON.stringify(pickupPasses.slice(0, 80)),
    );
  }, [pickupPasses]);

  const purgeCatalogItem = useCallback((target: PublishedLostItem | null, hintId: string) => {
    if (target) {
      markLostItemDeletedForTarget(target);
      removePublishedLostItemByTarget(target);
      setHomeLostItems((prev) => prev.filter((it) => !isSameCatalogItem(it, target)));
    } else {
      markLostItemDeleted(hintId);
      removePublishedLostItem(hintId);
      setHomeLostItems((prev) =>
        prev.filter(
          (it) =>
            String(it.id) !== hintId &&
            String(it.lostItemId ?? '') !== hintId &&
            String(it.reportId ?? '') !== hintId,
        ),
      );
    }
    setCatalogVersion((v) => v + 1);
    invalidateRemoteLostItemsCache();
  }, []);

  const removeLostItemAfterPickup = useCallback(
    async (lostItemId: string) => {
      if (!lostItemId) return;
      const hint = String(lostItemId);
      const pools = [...homeLostItemsRef.current, ...getPublishedLostItems()];
      const target = findCatalogItemByHint(hint, pools);
      purgeCatalogItem(target ?? null, hint);

      const serverId = target
        ? resolveServerLostItemId(target, hint, pools)
        : hint;
      if (API_BASE_URL && getAuthSession()?.accessToken && /^\d+$/.test(serverId)) {
        try {
          await apiJson<object>(
            `/api/lost-items/${encodeURIComponent(serverId)}`,
            { method: 'DELETE' },
          );
        } catch {
          // 화면에서는 이미 제거됨
        }
      }
    },
    [purgeCatalogItem],
  );

  const applyCatalogMerge = useCallback(
    (reportList: LostReport[], remoteItems: PublishedLostItem[]) => {
      const deletedIds = new Set(getDeletedLostItemIds());

      const collected: PublishedLostItem[] = [];

      const localPools = [
        ...homeLostItemsRef.current,
        ...getPublishedLostItems(),
      ];

      remoteItems
        .filter((item) => {
          if (isLostItemMarkedDeleted(item)) return false;
          const aliases = [item.id, item.lostItemId, item.reportId]
            .map((v) => String(v ?? '').trim())
            .filter(Boolean);
          if (aliases.some((key) => deletedIds.has(key))) return false;
          if (!item.reportId) return true;
          const linked = reportList.find(
            (r) => String(r.id) === String(item.reportId),
          );
          if (!linked) return true;
          return linked.status !== 'pending';
        })
        .forEach((item) => {
          const existing = localPools.find((local) =>
            isSameCatalogItem(local, item),
          );
          const merged = existing ? mergePublishedItems(item, existing) : item;
          collected.push({
            ...merged,
            image:
              resolveDisplayImageUrl(merged.image) ??
              resolveItemImageUrl(merged.image) ??
              merged.image,
          });
        });

      const remoteKeys = new Set<string>();
      remoteItems.forEach((item) => {
        [item.id, item.lostItemId, item.reportId]
          .map((v) => String(v ?? '').trim())
          .filter(Boolean)
          .forEach((key) => remoteKeys.add(key));
      });

      getPublishedLostItems().forEach((item) => {
        if (isLostItemMarkedDeleted(item)) return;
        const localKeys = [item.id, item.lostItemId, item.reportId]
          .map((v) => String(v ?? '').trim())
          .filter(Boolean);
        if (localKeys.some((key) => remoteKeys.has(key))) return;
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
            !linkedReportIds.has(String(r.id)) &&
            !isLostItemMarkedDeleted({
              id: String(r.id),
              reportId: String(r.id),
            }),
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
        let remoteItems: PublishedLostItem[] = [];
        try {
          remoteItems = await fetchRemoteLostItems();
        } catch {
          remoteItems = [];
        }
        setReports((current) => {
          applyCatalogMerge(current, remoteItems);
          return current;
        });
      } finally {
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

  const refreshReportsList = useCallback(async () => {
    if (!API_BASE_URL || !getAuthSession()?.accessToken) return;
    try {
      const remote = extractReportList(
        await apiJson<unknown>('/api/reports', { method: 'GET' }),
      );
      setReports((prev) => {
        const map = new Map<string, LostReport>();
        loadReportsLocal().forEach((r) => map.set(String(r.id), r));
        prev.forEach((r) => {
          const key = String(r.id);
          const existing = map.get(key);
          map.set(key, existing ? mergeReportRecords(existing, r) : r);
        });
        remote.forEach((r) => {
          const key = String(r.id);
          const existing = map.get(key);
          map.set(key, existing ? mergeReportRecords(existing, r) : r);
        });
        prev
          .filter((r) => r.status === 'pending')
          .forEach((r) => {
            const key = String(r.id);
            const onServer = remote.some((row) => String(row.id) === key);
            if (!map.has(key) && !onServer) map.set(key, r);
          });
        const next = Array.from(map.values()).sort((a, b) =>
          a.createdAt < b.createdAt ? 1 : -1,
        );
        persistReportsLocal(next);
        return next;
      });
    } catch {
      const local = loadReportsLocal();
      if (local.length > 0) {
        setReports((prev) => {
          const map = new Map<string, LostReport>();
          local.forEach((r) => map.set(String(r.id), r));
          prev.forEach((r) => {
            const key = String(r.id);
            const existing = map.get(key);
            map.set(key, existing ? mergeReportRecords(existing, r) : r);
          });
          return Array.from(map.values());
        });
      }
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
    if (!API_BASE_URL) return;
    setNoticesLoading(true);
    setNoticesError(null);
    try {
      const data = await apiJson<unknown>('/api/notices', { method: 'GET' });
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

  const bootstrapAfterAuth = useCallback(async () => {
    if (!getAuthSession()?.accessToken) return;
    void refreshNotices();
    void refreshHomeCatalogInner({ blocking: false });
    void refreshReportsList();
  }, [refreshHomeCatalogInner, refreshNotices, refreshReportsList]);

  useEffect(() => {
    if (getAuthSession()?.accessToken) {
      void bootstrapAfterAuth();
    }
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

    window.addEventListener(REPORTS_CHANGED_EVENT, syncReportsDebounced);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data?.type === 'reports') syncReportsDebounced();
      };
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener(REPORTS_CHANGED_EVENT, syncReportsDebounced);
      channel?.close();
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
              ownerEmail,
              ownerName,
              reporterName: ownerName,
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
          appendLocalNotice(
            '분실물 신고 접수',
            `${report.itemName} 신고가 접수되어 검수 대기에 등록되었습니다.`,
          );
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
                  r.status === 'pending',
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
                appendLocalNotice(
                  '분실물 신고 접수',
                  `${matched.itemName} 신고가 접수되어 검수 대기에 등록되었습니다.`,
                );
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
              image:
                resolveDisplayImageUrl(mapped.image) ??
                resolveItemImageUrl(mapped.image) ??
                displayImage,
            };
            const regIso = toApiDateTime(createdAtDisplay);
            const foundIso = toApiDateTime(lostAtDisplay);
            rememberItemTimes(itemId, { createdAt: regIso, foundAt: foundIso });
            if (mapped.reportId)
              rememberItemTimes(mapped.reportId, {
                createdAt: regIso,
                foundAt: foundIso,
              });
            rememberItemImage(itemId, mapped.image ?? displayImage);
            if (mapped.reportId)
              rememberItemImage(mapped.reportId, mapped.image ?? displayImage);
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
        let sourceReport = reportsRef.current.find(
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

        const updated: LostReport = { ...sourceReport, ...normalizedPatch };
        setReports((prev) => {
          const next = prev.map((report) =>
            String(report.id) === normalizedId ? updated : report,
          );
          persistReportsLocal(next);
          return next;
        });
        if (updated.image) {
          rememberItemImage(normalizedId, updated.image);
        }

        return {
          ok: true,
          message: '검수 대기 내용이 저장되었습니다. 습득 완료 시 서버에 함께 반영됩니다.',
        };
      },
      resolveReport: async (reportId, status, overrides) => {
        const normalizedId = String(reportId);
        const normalizedOverrides = overrides
          ? normalizePendingPatch(overrides)
          : undefined;

        const sourceReport = reportsRef.current.find(
          (report) => String(report.id) === normalizedId,
        );
        if (!sourceReport) {
          return {
            ok: false,
            message: '해당 신고를 찾을 수 없습니다. 목록을 새로고침해 주세요.',
          };
        }

        const resolvedReport: LostReport = {
          ...sourceReport,
          ...normalizedOverrides,
          status,
        };

        const publishResolvedToHome = () => {
          const registeredAtIso = nowISO();
          const registeredLabel =
            formatDateTimeLabel(registeredAtIso) || shortDateTime();
          let published = reportToPublishedItem(resolvedReport);
          if (!resolveItemImageUrl(published.image) && resolvedReport.image) {
            published = {
              ...published,
              image:
                resolveDisplayImageUrl(resolvedReport.image) ??
                resolveItemImageUrl(resolvedReport.image),
            };
          }
          published.createdAt = registeredLabel;
          rememberItemTimes(resolvedReport.id, {
            createdAt: registeredAtIso,
            foundAt: toApiDateTime(resolvedReport.lostAt),
          });
          rememberItemImage(resolvedReport.id, published.image);
          upsertPublishedLostItem(published);
          setHomeLostItems((prev) =>
            sortLostItemsNewestFirst(
              dedupePublishedCatalog([
                published,
                ...prev.filter((it) => !isSameCatalogItem(it, published)),
              ]),
            ),
          );
          setCatalogVersion((v) => v + 1);
        };

        setReports((prev) => {
          const next = prev.map((report) =>
            String(report.id) === normalizedId ? resolvedReport : report,
          );
          persistReportsLocal(next);
          return next;
        });

        if (status === 'resolved') {
          publishResolvedToHome();
        }

        setAdminAuditLogs((prev) => [
          {
            id: `a-${Date.now()}`,
            message: `${normalizedId} 신고건을 ${status === 'resolved' ? '습득 완료' : '습득 불가'}로 처리했습니다.`,
            createdAt: shortDateTime(),
          },
          ...prev,
        ]);

        if (status === 'resolved') {
          appendLocalNotice(
            '습득 완료 알림',
            `[${resolvedReport.itemName}] 습득이 확인되어 홈 목록에 공개되었습니다.`,
          );
        } else {
          appendLocalNotice(
            '습득 불가 알림',
            '신고하신 물품은 아직 습득되지 않은 것으로 처리되었습니다.',
          );
        }

        void (async () => {
          if (!API_BASE_URL) return;
          try {
            await patchReportStatus(normalizedId, status);
            if (status === 'resolved') {
              try {
                const posted = await publishLostItemToApi(
                  resolvedReport,
                  resolvedReport.image,
                );
                const postedId = String(posted?.id ?? posted?.lostItemId ?? '');
                if (postedId) {
                  const mapped =
                    mapApiLostItem({
                      ...(posted as Record<string, unknown>),
                      id: postedId,
                    }) ?? reportToPublishedItem(resolvedReport, postedId);
                  let published: PublishedLostItem = {
                    ...mapped,
                    id: postedId,
                    reportId: resolvedReport.id,
                  };
                  if (
                    !resolveItemImageUrl(published.image) &&
                    resolvedReport.image
                  ) {
                    published = {
                      ...published,
                      image:
                        resolveItemImageUrl(resolvedReport.image) ??
                        resolvedReport.image,
                    };
                  }
                  rememberItemImage(postedId, published.image);
                  rememberItemImage(resolvedReport.id, published.image);
                  upsertPublishedLostItem(published);
                  setHomeLostItems((prev) =>
                    sortLostItemsNewestFirst(
                      dedupePublishedCatalog([
                        published,
                        ...prev.filter(
                          (it) => !isSameCatalogItem(it, published),
                        ),
                      ]),
                    ),
                  );
                }
              } catch {
                // 화면 반영은 이미 완료
              }
            }
            scheduleHomeCatalogRefresh();
          } catch {
            // 로컬 처리는 완료됨
          }
        })();

        void refreshNotices();

        return {
          ok: true,
          message:
            status === 'resolved'
              ? '습득 완료 처리되었습니다. 홈에 바로 반영되었습니다.'
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

        const serverId = resolveServerLostItemId(target, normalizedId, pools);
        const mergedLocal: PublishedLostItem = {
          ...updated,
          id: serverId,
          lostItemId: /^\d+$/.test(serverId) ? serverId : updated.lostItemId,
        };
        rememberItemTimes(serverId, {
          createdAt: toApiDateTime(mergedLocal.createdAt),
          foundAt: toApiDateTime(mergedLocal.foundAt ?? mergedLocal.time),
        });
        if (mergedLocal.reportId) {
          rememberItemTimes(mergedLocal.reportId, {
            createdAt: toApiDateTime(mergedLocal.createdAt),
            foundAt: toApiDateTime(mergedLocal.foundAt ?? mergedLocal.time),
          });
        }
        rememberItemImage(serverId, mergedLocal.image);
        if (mergedLocal.reportId)
          rememberItemImage(mergedLocal.reportId, mergedLocal.image);
        upsertPublishedLostItem(mergedLocal);
        setHomeLostItems((prev) =>
          sortLostItemsNewestFirst(
            prev.map((it) =>
              isSameCatalogItem(it, mergedLocal) ? mergedLocal : it,
            ),
          ),
        );
        setCatalogVersion((v) => v + 1);

        if (API_BASE_URL && getAuthSession()?.accessToken) {
          void (async () => {
            try {
              const data = await apiJson<Record<string, unknown>>(
                `/api/lost-items/${encodeURIComponent(serverId)}`,
                {
                  method: 'PATCH',
                  body: JSON.stringify(patchBody),
                },
                { timeoutMs: 12_000 },
              );
              const mapped =
                mapApiLostItem({ ...data, id: serverId }) ?? mergedLocal;
              const merged: PublishedLostItem = {
                ...mergedLocal,
                ...mapped,
                id: serverId,
                image:
                  resolveDisplayImageUrl(mapped.image) ??
                  resolveItemImageUrl(mapped.image) ??
                  mergedLocal.image,
              };
              rememberItemImage(serverId, merged.image);
              upsertPublishedLostItem(merged);
              setHomeLostItems((prev) =>
                sortLostItemsNewestFirst(
                  prev.map((it) =>
                    isSameCatalogItem(it, merged) ? merged : it,
                  ),
                ),
              );
              invalidateRemoteLostItemsCache();
            } catch {
              // 화면 저장은 이미 반영됨
            }
          })();
          return {
            ok: true,
            message: '저장되었습니다. 화면에 바로 반영되었습니다.',
          };
        }

        return { ok: true, message: '로컬에 저장되었습니다. (API 미연동)' };
      },
      removeHomeLostItem: async (itemId) => {
        const normalizedId = String(itemId);
        const pools = [...homeLostItemsRef.current, ...getPublishedLostItems()];
        const target = findCatalogItemByHint(normalizedId, pools);

        const serverId = target
          ? resolveServerLostItemId(target, normalizedId, pools)
          : normalizedId;
        if (target) {
          markLostItemDeletedForTarget(target);
          removePublishedLostItemByTarget(target);
          clearLostItemOverridesForIds([
            target.id,
            target.lostItemId,
            target.reportId,
            serverId,
            normalizedId,
          ]);
          deleteCustomLostItem(target.id);
          setHomeLostItems((prev) => prev.filter((it) => !isSameCatalogItem(it, target)));
        } else {
          markLostItemDeleted(normalizedId);
          markLostItemDeleted(serverId);
          removePublishedLostItem(normalizedId);
          removePublishedLostItem(serverId);
          clearLostItemOverridesForIds([normalizedId, serverId]);
          deleteCustomLostItem(normalizedId);
          setHomeLostItems((prev) =>
            prev.filter(
              (it) =>
                String(it.id) !== normalizedId &&
                String(it.id) !== serverId &&
                String(it.lostItemId ?? '') !== serverId &&
                String(it.reportId ?? '') !== normalizedId,
            ),
          );
        }
        setCatalogVersion((v) => v + 1);
        invalidateRemoteLostItemsCache();

        if (
          API_BASE_URL &&
          getAuthSession()?.accessToken &&
          /^\d+$/.test(serverId)
        ) {
          void apiJson<object>(
            `/api/lost-items/${encodeURIComponent(serverId)}`,
            { method: 'DELETE' },
            { timeoutMs: API_MUTATION_TIMEOUT_MS },
          ).catch(() => {
            // 화면에서는 이미 제거됨
          });
        }

        return {
          ok: true,
          message: '물품이 삭제되어 홈·검색에서 제외되었습니다.',
        };
      },
      issuePickupPass: async (payload) => {
        if (!payload?.lostItemId) {
          return {
            ok: false,
            message: '발급할 분실물 정보가 없습니다.',
            token: undefined,
          };
        }

        const session = getAuthSession();
        const claimantName = session?.name;
        const claimantEmail = session?.email;

        const buildPass = (override?: Partial<PickupPass>): PickupPass => ({
          id: override?.id ?? `p-${Date.now()}`,
          lostItemId: payload.lostItemId,
          itemName: payload.itemName,
          itemImage: payload.itemImage,
          itemLocation: payload.itemLocation,
          claimantName,
          claimantEmail,
          token: override?.token ?? pickupToken(),
          issuedAt: override?.issuedAt ?? shortDateTime(),
          expiresAt: override?.expiresAt ?? minutesLaterISO(10),
          usedAt: override?.usedAt ?? null,
          reportId: override?.reportId,
        });

        const finalize = (pass: PickupPass, message: string) => {
          setPickupPasses((prev) => [
            pass,
            ...prev.filter((it) => it.id !== pass.id),
          ]);
          void refreshNotices();
          return { ok: true, message, token: pass.token, pass };
        };

        try {
          const data = await apiJson<{
            id?: string;
            token?: string;
            expiresAt?: string;
            issuedAt?: string;
            usedAt?: string | null;
            message?: string;
            reportId?: string;
          }>('/api/pickup-passes', {
            method: 'POST',
            body: JSON.stringify({
              lostItemId: payload.lostItemId,
              itemName: payload.itemName,
              itemImage: payload.itemImage,
              itemLocation: payload.itemLocation,
              claimantName,
              claimantEmail,
            }),
          });

          const pass = buildPass({
            id: data.id,
            token: data.token,
            issuedAt: data.issuedAt,
            expiresAt: data.expiresAt,
            usedAt: data.usedAt ?? null,
            reportId: data.reportId,
          });
          return finalize(pass, data.message ?? '수령 QR이 발급되었습니다.');
        } catch (error) {
          return {
            ok: false,
            message:
              error instanceof Error
                ? `QR 발급에 실패했습니다. (${error.message})`
                : 'QR 발급에 실패했습니다.',
            token: undefined,
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

        const finalize = (
          pass: PickupPass,
          usedAt: string,
          message: string,
        ): PickupVerifyResult => {
          setPickupPasses((prev) =>
            prev.map((it) =>
              it.token.toUpperCase() === normalized ? { ...it, usedAt } : it,
            ),
          );
          if (pass.reportId) {
            setReports((prev) =>
              prev.map((report) =>
                String(report.id) === String(pass.reportId)
                  ? { ...report, status: 'picked_up', pickedUpAt: usedAt }
                  : report,
              ),
            );
          }
          const pickupLostId = String(pass.lostItemId ?? '').trim();
          if (pickupLostId) {
            void removeLostItemAfterPickup(pickupLostId);
          }
          invalidateRemoteLostItemsCache();
          scheduleHomeCatalogRefresh();
          setAdminAuditLogs((prev) => [
            {
              id: `a-${Date.now()}`,
              message: `[${pass.itemName ?? '물품'}] QR 수령 인증 완료 — 인수자: ${pass.claimantName ?? '이름 없음'} (${pass.claimantEmail ?? '이메일 없음'})`,
              createdAt: usedAt,
            },
            ...prev,
          ]);
          void refreshNotices();
          return { ok: true, message, pass: { ...pass, usedAt } };
        };

        try {
          const data = await apiJson<{
            ok?: boolean;
            reportId?: string;
            usedAt?: string;
            message?: string;
            lostItemId?: string;
            itemName?: string;
            claimantName?: string;
            claimantEmail?: string;
            requesterEmail?: string;
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

          const usedAt = data.usedAt ?? shortDateTime();
          const lostItemIdFromApi = String(
            data.lostItemId ??
              (/^\d+$/.test(String(data.reportId ?? '')) ? data.reportId : '') ??
              localPass?.lostItemId ??
              '',
          );
          const merged: PickupPass = {
            id: localPass?.id ?? `p-${Date.now()}`,
            lostItemId: lostItemIdFromApi,
            itemName: data.itemName ?? localPass?.itemName,
            itemImage: localPass?.itemImage,
            itemLocation: localPass?.itemLocation,
            claimantName: data.claimantName ?? localPass?.claimantName,
            claimantEmail:
              data.claimantEmail ??
              data.requesterEmail ??
              localPass?.claimantEmail,
            token: localPass?.token ?? normalized,
            issuedAt: localPass?.issuedAt ?? shortDateTime(),
            expiresAt: localPass?.expiresAt ?? minutesLaterISO(10),
            usedAt,
            reportId: localPass?.reportId,
          };
          invalidateRemoteLostItemsCache();
          return finalize(
            merged,
            usedAt,
            data.message ?? 'QR 인증 완료: 최종 수령 처리되었습니다.',
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'QR 인증 처리에 실패했습니다.';
          if (/403|권한|admin/i.test(message)) {
            return {
              ok: false,
              message:
                '관리자 권한이 필요합니다. 관리자 계정으로 로그인해 주세요.',
            };
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
          setReports((prev) => prev.filter((report) => report.id !== reportId));
          setAdminAuditLogs((prev) => [
            {
              id: `a-${Date.now()}`,
              message: `${reportId} 신고건이 삭제되었습니다.`,
              createdAt: shortDateTime(),
            },
            ...prev,
          ]);
        };

        // 로컬 임시 신고(r-local-...)는 백엔드 호출 없이 바로 삭제
        if (!API_BASE_URL || reportId.startsWith('r-local-')) {
          removeLocal();
          return { ok: true, message: '신고 항목이 삭제되었습니다.' };
        }

        try {
          await apiJson<object>(
            `/api/reports/${encodeURIComponent(reportId)}`,
            { method: 'DELETE' },
          );
          removeLocal();
          return { ok: true, message: '신고 항목이 삭제되었습니다.' };
        } catch (error) {
          // 백엔드 실패해도 사용자 화면에서는 사라지도록 로컬 제거 진행
          removeLocal();
          return {
            ok: true,
            message:
              error instanceof Error
                ? `로컬에서만 삭제되었습니다. (서버 오류: ${error.message})`
                : '로컬에서만 삭제되었습니다. (서버 오류)',
          };
        }
      },
      refreshNotices,
      refreshReports,
      refreshReportsList,
      refreshHomeCatalog,
      deleteNotice: async (noticeId) => {
        const target = notices.find((notice) => notice.id === noticeId);
        if (!target) {
          return { ok: false, message: '삭제할 알림을 찾을 수 없습니다.' };
        }

        setNotices((prev) => prev.filter((notice) => notice.id !== noticeId));

        if (!API_BASE_URL || noticeId.startsWith('n-')) {
          return { ok: true, message: '알림이 삭제되었습니다.' };
        }

        try {
          await apiJson<object>(
            `/api/notices/${encodeURIComponent(noticeId)}`,
            { method: 'DELETE' },
          );
          return { ok: true, message: '알림이 삭제되었습니다.' };
        } catch (error) {
          return {
            ok: true,
            message:
              error instanceof Error
                ? `화면에서 삭제했습니다. (서버: ${error.message})`
                : '화면에서 삭제했습니다.',
          };
        }
      },
      deleteAllNotices: async () => {
        setNotices([]);
        if (!API_BASE_URL) {
          return { ok: true, message: '모든 알림을 삭제했습니다.' };
        }
        try {
          await apiJson<object>('/api/notices', { method: 'DELETE' });
        } catch {
          // 백엔드 일괄 삭제 미지원 시 로컬만 비움
        }
        return { ok: true, message: '모든 알림을 삭제했습니다.' };
      },
      markNoticeRead: async (noticeId) => {
        const target = notices.find((notice) => notice.id === noticeId);
        if (!target) {
          return { ok: false, message: '대상 알림을 찾을 수 없습니다.' };
        }

        // 낙관적 업데이트
        setNotices((prev) =>
          prev.map((notice) =>
            notice.id === noticeId ? { ...notice, read: true } : notice,
          ),
        );

        // 프론트 임시 알림(n- prefix)이거나 백엔드 미설정이면 로컬만 처리
        if (!API_BASE_URL || noticeId.startsWith('n-')) {
          return { ok: true, message: '읽음 처리되었습니다.' };
        }

        try {
          // PATCH body 없이 호출 (백엔드 스펙: PATCH /api/notices/{id}/read)
          await apiJson<{ message?: string }>(`/api/notices/${noticeId}/read`, {
            method: 'PATCH',
          });
          return { ok: true, message: '읽음 처리되었습니다.' };
        } catch (error) {
          // 백엔드 실패해도 사용자 경험상 읽음 상태는 유지 (다음 새로고침 때 동기화 시도)
          return {
            ok: true,
            message:
              error instanceof Error
                ? `읽음 처리 (서버 연동 실패: ${error.message})`
                : '읽음 처리 (서버 연동 실패)',
          };
        }
      },
    }),
    [
      adminAuditLogs,
      applyCatalogMerge,
      catalogLoading,
      catalogVersion,
      homeLostItems,
      notices,
      noticesError,
      noticesLoading,
      pickupPasses,
      refreshHomeCatalog,
      refreshNotices,
      appendLocalNotice,
      refreshReports,
      reports,
      removeLostItemAfterPickup,
      pickupPasses,
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
