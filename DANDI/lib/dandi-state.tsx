"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { extractStudentIdFromEmail, getAuthSession } from "@/lib/auth-session";
import { markLostItemDeleted } from "@/lib/custom-lost-items";
import { safeSetLocalStorage } from "@/lib/safe-local-storage";
import {
  enrichPublishedItemsWithReports,
  getPublishedLostItems,
  mapApiLostItem,
  removePublishedLostItem,
  reportToPublishedItem,
  upsertPublishedLostItem,
  type PublishedLostItem,
} from "@/lib/published-lost-items";
import { fetchRemoteLostItems, sortLostItemsNewestFirst } from "@/lib/catalog-utils";
import { apiJson, getApiBaseUrl, patchReportStatus } from "@/lib/api-json";
import {
  formatDateTimeLabel,
  normalizeReportStatus,
  sanitizeLocation,
  toApiDateTime,
} from "@/lib/format-display";
import { normalizePickupToken } from "@/lib/qr-scanner";
import { apiImageFields, pickImageFromRaw, resolveItemImageUrl, resolveMediaUrl } from "@/lib/media-url";
import { compactDandiLocalStorage } from "@/lib/safe-local-storage";
import { getStoredLocalNotices, setStoredLocalNotices } from "@/lib/user-preferences";

export type ReportStatus = "pending" | "resolved" | "picked_up" | "unavailable";

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
  submitReport: (payload: Omit<LostReport, "id" | "status" | "createdAt">) => Promise<{ ok: boolean; message: string; reportId?: string }>;
  publishAdminLostItem: (
    payload: Omit<LostReport, "id" | "status" | "createdAt">
  ) => Promise<{ ok: boolean; message: string; itemId?: string }>;
  resolveReport: (
    reportId: string,
    status: Extract<ReportStatus, "resolved" | "unavailable">
  ) => Promise<{ ok: boolean; message: string }>;
  updateHomeLostItem: (itemId: string, patch: Partial<PublishedLostItem>) => void;
  removeHomeLostItem: (itemId: string) => void | Promise<void>;
  issuePickupPass: (payload: PickupIssuePayload) => Promise<{ ok: boolean; message: string; token?: string; pass?: PickupPass }>;
  verifyPickupPass: (token: string) => Promise<PickupVerifyResult>;
  deleteReport: (reportId: string) => Promise<{ ok: boolean; message: string }>;
  refreshNotices: () => Promise<void>;
  refreshReports: () => Promise<void>;
  refreshReportsList: () => Promise<void>;
  refreshHomeCatalog: () => Promise<void>;
  markNoticeRead: (noticeId: string) => Promise<{ ok: boolean; message: string }>;
  deleteNotice: (noticeId: string) => Promise<{ ok: boolean; message: string }>;
  deleteAllNotices: () => Promise<{ ok: boolean; message: string }>;
};

const DandiStateContext = createContext<DandiStateContextValue | null>(null);
const API_BASE_URL = getApiBaseUrl();
export const REPORTS_CHANGED_EVENT = "dandi-reports-changed";
const PICKUP_PASSES_KEY = "dandi.pickupPasses";
const SYNC_CHANNEL = "dandi-sync";

function notifyReportsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REPORTS_CHANGED_EVENT));
  try {
    new BroadcastChannel(SYNC_CHANNEL).postMessage({ type: "reports" });
  } catch {
    // BroadcastChannel 미지원 환경
  }
}

function getStoredPickupPasses(): PickupPass[] {
  if (typeof window === "undefined") return [];
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
  return new Date().toLocaleString("ko-KR", { hour12: false });
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
    title: String(raw.title ?? "알림"),
    message: String(raw.message ?? raw.body ?? raw.content ?? ""),
    createdAt: formatDateTimeLabel(String(raw.createdAt ?? raw.sentAt ?? "")) || shortDateTime(),
    read: Boolean(raw.read ?? raw.isRead ?? false),
  };
}

function extractNoticeList(payload: unknown): UserNotice[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as { content?: unknown[]; data?: unknown[]; items?: unknown[] }).content ??
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
    category: String(raw.category ?? "기타"),
    lostAt: formatDateTimeLabel(String(raw.lostAt ?? raw.foundAt ?? "")),
    location: sanitizeLocation(String(raw.location ?? raw.place ?? "")),
    memo: raw.memo != null ? String(raw.memo) : undefined,
    image: pickImageFromRaw(raw),
    itemType: raw.itemType != null ? String(raw.itemType) : raw.type != null ? String(raw.type) : undefined,
    storage: raw.storage != null ? String(raw.storage) : undefined,
    status,
    createdAt: formatDateTimeLabel(String(raw.createdAt ?? "")) || shortDateTime(),
    pickedUpAt: raw.pickedUpAt != null ? formatDateTimeLabel(String(raw.pickedUpAt)) || String(raw.pickedUpAt) : undefined,
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
    : payload && typeof payload === "object"
      ? ((payload as { content?: unknown[]; data?: unknown[]; items?: unknown[] }).content ??
        (payload as { data?: unknown[] }).data ??
        (payload as { items?: unknown[] }).items ??
        [])
      : [];
  return list
    .map((row) => normalizeReport(row as Record<string, unknown>))
    .filter((row): row is LostReport => row !== null);
}

async function publishLostItemToApi(report: LostReport) {
  if (!API_BASE_URL) return;
  const foundAtIso = toApiDateTime(report.lostAt);
  const createdAtIso = nowISO();
  await apiJson<{ id?: string; lostItemId?: string; message?: string }>("/api/lost-items", {
    method: "POST",
    body: JSON.stringify({
      reportId: report.id,
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
      ...apiImageFields(report.image),
      status: "published",
    }),
  });
}

async function publishAdminLostItemToApi(
  payload: Omit<LostReport, "id" | "status" | "createdAt">
): Promise<{ id?: string; lostItemId?: string; message?: string } & Record<string, unknown>> {
  const foundAtIso = toApiDateTime(payload.lostAt);
  const createdAtIso = nowISO();
  return apiJson("/api/lost-items", {
    method: "POST",
    body: JSON.stringify({
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
      ...apiImageFields(payload.image),
      status: "published",
    }),
  });
}

export function DandiStateProvider({ children }: { children: React.ReactNode }) {
  const [reports, setReports] = useState<LostReport[]>([]);
  const [homeLostItems, setHomeLostItems] = useState<PublishedLostItem[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [notices, setNotices] = useState<UserNotice[]>(() => {
    const stored = getStoredLocalNotices();
    if (stored.length > 0) return stored;
    return [
      {
        id: "n-1001",
        title: "알림 설정이 활성화되었습니다",
        message: "관심 키워드와 일치하는 습득물이 등록되면 바로 알려드려요.",
        createdAt: shortDateTime(),
        read: false,
      },
    ];
  });
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [noticesError, setNoticesError] = useState<string | null>(null);

  // 로컬 알림(n- prefix)은 새로고침/세션 사이에 유지되도록 localStorage에 백업합니다.
  useEffect(() => {
    const localOnly = notices.filter((it) => it.id.startsWith("n-"));
    setStoredLocalNotices(localOnly);
  }, [notices]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([
    {
      id: "a-1001",
      message: "관리자 대시보드가 초기화되었습니다.",
      createdAt: shortDateTime(),
    },
  ]);
  const [pickupPasses, setPickupPasses] = useState<PickupPass[]>(() => getStoredPickupPasses());

  useEffect(() => {
    compactDandiLocalStorage();
  }, []);

  useEffect(() => {
    safeSetLocalStorage(PICKUP_PASSES_KEY, JSON.stringify(pickupPasses.slice(0, 80)));
  }, [pickupPasses]);

  const removeLostItemAfterPickup = useCallback(async (lostItemId: string) => {
    if (!lostItemId) return;
    markLostItemDeleted(lostItemId);
    removePublishedLostItem(lostItemId);
    setHomeLostItems((prev) => prev.filter((it) => String(it.id) !== String(lostItemId)));
    setCatalogVersion((v) => v + 1);
    if (API_BASE_URL && getAuthSession()?.accessToken) {
      try {
        await apiJson<object>(`/api/lost-items/${encodeURIComponent(lostItemId)}`, { method: "DELETE" });
      } catch {
        // 삭제 API 미구현 시 화면만 반영
      }
    }
  }, []);

  const applyCatalogMerge = useCallback((reportList: LostReport[], remoteItems: PublishedLostItem[]) => {
    const merged = new Map<string, PublishedLostItem>();

    remoteItems.forEach((item) => {
      merged.set(String(item.id), { ...item, image: resolveItemImageUrl(item.image) });
    });

    if (!API_BASE_URL) {
      const localPublished = getPublishedLostItems();
      localPublished.forEach((item) => {
        merged.set(String(item.id), { ...item, image: resolveItemImageUrl(item.image) });
      });
    }

    reportList
      .filter((r) => r.status === "resolved")
      .map(reportToPublishedItem)
      .forEach((item) => {
        const key = String(item.id);
        if (!merged.has(key)) merged.set(key, item);
      });

    const next = sortLostItemsNewestFirst(enrichPublishedItemsWithReports(Array.from(merged.values()), reportList));
    setHomeLostItems(next);
    setCatalogVersion((v) => v + 1);
  }, []);

  const refreshHomeCatalog = useCallback(async () => {
    if (!API_BASE_URL || !getAuthSession()?.accessToken) return;
    setCatalogLoading(true);
    try {
      const remoteItems = await fetchRemoteLostItems();
      setReports((current) => {
        applyCatalogMerge(current, remoteItems);
        return current;
      });
    } finally {
      setCatalogLoading(false);
    }
  }, [applyCatalogMerge]);

  const refreshReportsList = useCallback(async () => {
    if (!API_BASE_URL || !getAuthSession()?.accessToken) return;
    try {
      const remote = extractReportList(await apiJson<unknown>("/api/reports", { method: "GET" }));
      setReports((prev) => {
        const map = new Map<string, LostReport>();
        prev.forEach((r) => map.set(r.id, r));
        remote.forEach((r) => {
          const existing = map.get(r.id);
          map.set(r.id, {
            ...r,
            image: r.image ?? existing?.image,
            ownerName: r.ownerName ?? existing?.ownerName,
            ownerEmail: r.ownerEmail ?? existing?.ownerEmail,
          });
        });
        return Array.from(map.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      });
    } catch {
      // GET 미지원 백엔드는 로컬 reports 유지
    }
  }, []);

  const refreshReports = useCallback(async () => {
    await refreshReportsList();
    await refreshHomeCatalog();
  }, [refreshHomeCatalog, refreshReportsList]);

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
      const data = await apiJson<unknown>("/api/notices", { method: "GET" });
      const remote = extractNoticeList(data);
      setNotices((prev) => {
        const localOnly = prev.filter((it) => it.id.startsWith("n-"));
        const merged = [...remote, ...localOnly];
        const dedup = new Map<string, UserNotice>();
        merged.forEach((notice) => {
          if (!dedup.has(notice.id)) dedup.set(notice.id, notice);
        });
        return Array.from(dedup.values());
      });
    } catch (error) {
      setNoticesError(error instanceof Error ? error.message : "알림 목록을 불러오지 못했습니다.");
    } finally {
      setNoticesLoading(false);
    }
  }, []);

  const bootstrapAfterAuth = useCallback(async () => {
    if (!getAuthSession()?.accessToken) return;
    await refreshReports();
    await refreshNotices();
  }, [refreshNotices, refreshReports]);

  useEffect(() => {
    if (getAuthSession()?.accessToken) {
      void bootstrapAfterAuth();
    }
    const onAuthChanged = () => {
      void bootstrapAfterAuth();
    };
    window.addEventListener("dandi-auth-changed", onAuthChanged);
    return () => window.removeEventListener("dandi-auth-changed", onAuthChanged);
  }, [bootstrapAfterAuth]);

  useEffect(() => {
    const syncReportsFull = () => {
      if (getAuthSession()?.accessToken) void refreshReports();
    };
    const syncReportsListOnly = () => {
      if (getAuthSession()?.accessToken) void refreshReportsList();
    };

    window.addEventListener(REPORTS_CHANGED_EVENT, syncReportsFull);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data?.type === "reports") syncReportsFull();
      };
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener(REPORTS_CHANGED_EVENT, syncReportsFull);
      channel?.close();
    };
  }, [refreshReports, refreshReportsList]);

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
        const lostAtDisplay = formatDateTimeLabel(payload.lostAt) || payload.lostAt;
        const lostAtIso = toApiDateTime(payload.lostAt);
        const normalizedPayload = {
          ...payload,
          location: sanitizeLocation(payload.location),
          lostAt: lostAtDisplay,
          storage: payload.storage ? sanitizeLocation(payload.storage) : payload.storage,
          image: resolveItemImageUrl(payload.image),
        };
        try {
          const data = await apiJson<Record<string, unknown>>("/api/reports", {
            method: "POST",
            body: JSON.stringify({
              ...normalizedPayload,
              lostAt: lostAtIso,
              foundAt: lostAtIso,
              ownerEmail,
              ownerName,
              reporterName: ownerName,
              reporterEmail: ownerEmail,
              ...apiImageFields(normalizedPayload.image),
            }),
          });
          const reportId = String(data.id ?? data.reportId ?? `r-${Date.now()}`);
          const report: LostReport = {
            id: reportId,
            ...normalizedPayload,
            image: pickImageFromRaw(data) ?? normalizedPayload.image ?? undefined,
            status: normalizeReportStatus(data.status),
            createdAt: formatDateTimeLabel(String(data.createdAt ?? "")) || shortDateTime(),
            ownerEmail,
            ownerName,
          };
          setReports((prev) => [report, ...prev.filter((it) => String(it.id) !== reportId)]);
          appendLocalNotice("분실물 신고 접수", `${report.itemName} 신고가 접수되어 검수 대기에 등록되었습니다.`);
          void refreshNotices();
          await refreshReports();
          notifyReportsChanged();
          return {
            ok: true,
            message: data.message ? String(data.message) : "신고가 접수되었습니다.",
            reportId,
          };
        } catch (error) {
          if (API_BASE_URL) {
            try {
              const remote = extractReportList(await apiJson<unknown>("/api/reports", { method: "GET" }));
              const matched = remote.find(
                (r) =>
                  r.itemName === payload.itemName &&
                  r.location === sanitizeLocation(payload.location) &&
                  r.status === "pending"
              );
              if (matched) {
                setReports((prev) => [matched, ...prev.filter((it) => String(it.id) !== matched.id)]);
                appendLocalNotice("분실물 신고 접수", `${matched.itemName} 신고가 접수되어 검수 대기에 등록되었습니다.`);
                await refreshReports();
                return {
                  ok: true,
                  message: "신고가 접수되었습니다. (서버 응답 형식이 달라 목록을 다시 불러왔습니다.)",
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
                : "신고 접수에 실패했습니다.",
          };
        }
      },
      publishAdminLostItem: async (payload) => {
        const lostAtDisplay = formatDateTimeLabel(payload.lostAt) || payload.lostAt;
        const createdAtDisplay = shortDateTime();
        const normalizedPayload = {
          ...payload,
          location: sanitizeLocation(payload.location),
          lostAt: lostAtDisplay,
          storage: payload.storage ? sanitizeLocation(payload.storage) : payload.storage,
          image: resolveItemImageUrl(payload.image),
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
            const data = await publishAdminLostItemToApi(normalizedPayload);
            const itemId = String(data.id ?? data.lostItemId ?? `adm-${Date.now()}`);
            const mapped =
              mapApiLostItem({ ...data, id: itemId, ...normalizedPayload, itemName: normalizedPayload.itemName }) ??
              buildLocalItem(itemId);
            upsertPublishedLostItem(mapped);
            await refreshHomeCatalog();
            setAdminAuditLogs((prev) => [
              {
                id: `a-${Date.now()}`,
                message: `관리자 직접 등록: ${normalizedPayload.itemName} (홈 즉시 노출)`,
                createdAt: shortDateTime(),
              },
              ...prev,
            ]);
            return { ok: true, message: "홈·검색에 바로 등록되었습니다.", itemId };
          } catch (error) {
            return {
              ok: false,
              message:
                error instanceof Error
                  ? `등록에 실패했습니다. (${error.message})`
                  : "등록에 실패했습니다.",
            };
          }
        }

        const localId = `adm-${Date.now()}`;
        const localItem = buildLocalItem(localId);
        upsertPublishedLostItem(localItem);
        setHomeLostItems((prev) => sortLostItemsNewestFirst([localItem, ...prev]));
        setCatalogVersion((v) => v + 1);
        return { ok: true, message: "홈·검색에 바로 등록되었습니다.", itemId: localId };
      },
      resolveReport: async (reportId, status) => {
        const normalizedId = String(reportId);

        const applyResolved = async () => {
          const sourceReport = reports.find((report) => String(report.id) === normalizedId);
          if (!sourceReport) return;
          const resolvedReport: LostReport = { ...sourceReport, status };
          setReports((prev) =>
            prev.map((report) => (String(report.id) === normalizedId ? resolvedReport : report))
          );
          if (status === "resolved") {
            const published = reportToPublishedItem(resolvedReport);
            upsertPublishedLostItem(published);
            setHomeLostItems((prev) =>
              sortLostItemsNewestFirst([
                published,
                ...prev.filter((it) => String(it.id) !== String(published.id)),
              ])
            );
            setCatalogVersion((v) => v + 1);
            try {
              await publishLostItemToApi(resolvedReport);
            } catch {
              // lost-items API 미구현 시 refresh로 동기화
            }
          }
          await refreshHomeCatalog();
          notifyReportsChanged();
          setAdminAuditLogs((prev) => [
            {
              id: `a-${Date.now()}`,
              message: `${normalizedId} 신고건을 ${status === "resolved" ? "습득 완료" : "습득 불가"}로 처리했습니다.`,
              createdAt: shortDateTime(),
            },
            ...prev,
          ]);
          if (!serverSynced) {
            if (status === "resolved") {
              appendLocalNotice(
                "습득 완료 알림",
                `[${sourceReport.itemName}] 습득이 확인되어 홈 목록에 공개되었습니다.`
              );
            } else {
              appendLocalNotice("습득 불가 알림", "신고하신 물품은 아직 습득되지 않은 것으로 처리되었습니다.");
            }
          }
          await refreshNotices();
        };

        let serverSynced = false;
        let serverError = "";
        if (API_BASE_URL) {
          try {
            await patchReportStatus(normalizedId, status);
            serverSynced = true;
          } catch (error) {
            serverError = error instanceof Error ? error.message : "서버 동기화 실패";
          }
        }

        let found = false;
        setReports((prev) => {
          found = prev.some((report) => String(report.id) === normalizedId);
          return prev;
        });
        if (!found) {
          return { ok: false, message: "해당 신고를 찾을 수 없습니다. 목록을 새로고침해 주세요." };
        }

        await applyResolved();

        if (serverSynced) {
          return { ok: true, message: "상태 변경이 완료되었습니다. 홈 목록에 반영되었습니다." };
        }
        return {
          ok: true,
          message: serverError
            ? `화면에 반영했습니다. (서버: ${serverError})`
            : "상태 변경이 완료되었습니다. 홈 목록에 반영되었습니다.",
        };
      },
      updateHomeLostItem: (itemId, patch) => {
        const current = getPublishedLostItems();
        const target = current.find((it) => it.id === itemId) ?? homeLostItems.find((it) => it.id === itemId);
        if (!target) return;
        const foundAtLabel = patch.foundAt ?? patch.time ?? target.foundAt ?? target.time;
        const createdAtLabel = patch.createdAt ?? target.createdAt;
        const updated = {
          ...target,
          ...patch,
          time: formatDateTimeLabel(foundAtLabel) || foundAtLabel || target.time,
          foundAt: formatDateTimeLabel(foundAtLabel) || foundAtLabel,
          createdAt: formatDateTimeLabel(createdAtLabel) || createdAtLabel,
        };
        upsertPublishedLostItem(updated);
        setHomeLostItems((prev) =>
          sortLostItemsNewestFirst(prev.map((it) => (it.id === itemId ? updated : it)))
        );
        setCatalogVersion((v) => v + 1);
        if (API_BASE_URL) {
          void apiJson(`/api/lost-items/${itemId}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: updated.name,
              itemName: updated.name,
              category: updated.category,
              location: updated.place,
              place: updated.place,
              foundAt: toApiDateTime(updated.foundAt ?? updated.time),
              lostAt: toApiDateTime(updated.foundAt ?? updated.time),
              createdAt: updated.createdAt ? toApiDateTime(updated.createdAt) : undefined,
              registeredAt: updated.createdAt ? toApiDateTime(updated.createdAt) : undefined,
              memo: updated.memo,
              itemType: updated.type,
              storage: updated.storage,
              ...apiImageFields(updated.image),
            }),
          }).catch(() => undefined);
        }
      },
      removeHomeLostItem: async (itemId) => {
        if (API_BASE_URL && getAuthSession()?.accessToken) {
          try {
            await apiJson<object>(`/api/lost-items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
          } catch {
            // 삭제 API 미구현 시 화면만 반영
          }
        }
        removePublishedLostItem(itemId);
        setHomeLostItems((prev) => prev.filter((it) => it.id !== itemId));
        setCatalogVersion((v) => v + 1);
        void refreshHomeCatalog();
      },
      issuePickupPass: async (payload) => {
        if (!payload?.lostItemId) {
          return { ok: false, message: "발급할 분실물 정보가 없습니다.", token: undefined };
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
          setPickupPasses((prev) => [pass, ...prev.filter((it) => it.id !== pass.id)]);
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
          }>("/api/pickup-passes", {
            method: "POST",
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
          return finalize(pass, data.message ?? "수령 QR이 발급되었습니다.");
        } catch (error) {
          const pass = buildPass();
          return finalize(
            pass,
            error instanceof Error
              ? `백엔드 연동 실패로 QR을 임시 발급했습니다. (${error.message})`
              : "백엔드 연동 실패로 QR을 임시 발급했습니다."
          );
        }
      },
      verifyPickupPass: async (token) => {
        const normalized = normalizePickupToken(token);
        if (!normalized) {
          return { ok: false, message: "QR 코드를 입력해 주세요." };
        }
        if (!/^DKU-[A-Z0-9]{6,}$/.test(normalized)) {
          return { ok: false, message: "올바른 수령 코드 형식이 아닙니다. (DKU-로 시작)" };
        }

        const localPass = pickupPasses.find((it) => it.token.toUpperCase() === normalized);
        if (localPass?.usedAt) {
          return { ok: false, message: "이미 수령 인증이 완료된 코드입니다." };
        }

        const finalize = async (
          pass: PickupPass,
          usedAt: string,
          message: string
        ): Promise<PickupVerifyResult> => {
          setPickupPasses((prev) =>
            prev.map((it) => (it.token.toUpperCase() === normalized ? { ...it, usedAt } : it))
          );
          if (pass.reportId) {
            setReports((prev) =>
              prev.map((report) =>
                String(report.id) === String(pass.reportId) ? { ...report, status: "picked_up", pickedUpAt: usedAt } : report
              )
            );
          }
          if (pass.lostItemId) {
            await removeLostItemAfterPickup(pass.lostItemId);
          }
          void refreshHomeCatalog();
          setAdminAuditLogs((prev) => [
            {
              id: `a-${Date.now()}`,
              message: `[${pass.itemName ?? "물품"}] QR 수령 인증 완료 — 인수자: ${pass.claimantName ?? "이름 없음"} (${pass.claimantEmail ?? "이메일 없음"})`,
              createdAt: usedAt,
            },
            ...prev,
          ]);
          void refreshNotices();
          return { ok: true, message, pass: { ...pass, usedAt } };
        };

        try {
          const data = await apiJson<{
            reportId?: string;
            usedAt?: string;
            message?: string;
            lostItemId?: string;
            itemName?: string;
            claimantName?: string;
            claimantEmail?: string;
          }>("/api/pickup-passes/verify", {
            method: "POST",
            body: JSON.stringify({ token: normalized }),
          });

          const usedAt = data.usedAt ?? shortDateTime();
          const merged: PickupPass = {
            id: localPass?.id ?? `p-${Date.now()}`,
            lostItemId: data.lostItemId ?? localPass?.lostItemId ?? "",
            itemName: data.itemName ?? localPass?.itemName,
            itemImage: localPass?.itemImage,
            itemLocation: localPass?.itemLocation,
            claimantName: data.claimantName ?? localPass?.claimantName,
            claimantEmail: data.claimantEmail ?? localPass?.claimantEmail,
            token: localPass?.token ?? normalized,
            issuedAt: localPass?.issuedAt ?? shortDateTime(),
            expiresAt: localPass?.expiresAt ?? minutesLaterISO(10),
            usedAt,
            reportId: data.reportId ?? localPass?.reportId,
          };
          return await finalize(merged, usedAt, data.message ?? "QR 인증 완료: 최종 수령 처리되었습니다.");
        } catch (error) {
          if (!localPass) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "QR 인증 처리에 실패했습니다.",
            };
          }
          const usedAt = shortDateTime();
          return await finalize(
            localPass,
            usedAt,
            error instanceof Error
              ? `백엔드 연동 실패로 로컬 인증만 진행했습니다. (${error.message})`
              : "백엔드 연동 실패로 로컬 인증만 진행했습니다."
          );
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
        if (!API_BASE_URL || reportId.startsWith("r-local-")) {
          removeLocal();
          return { ok: true, message: "신고 항목이 삭제되었습니다." };
        }

        try {
          await apiJson<object>(`/api/reports/${encodeURIComponent(reportId)}`, { method: "DELETE" });
          removeLocal();
          return { ok: true, message: "신고 항목이 삭제되었습니다." };
        } catch (error) {
          // 백엔드 실패해도 사용자 화면에서는 사라지도록 로컬 제거 진행
          removeLocal();
          return {
            ok: true,
            message:
              error instanceof Error
                ? `로컬에서만 삭제되었습니다. (서버 오류: ${error.message})`
                : "로컬에서만 삭제되었습니다. (서버 오류)",
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
          return { ok: false, message: "삭제할 알림을 찾을 수 없습니다." };
        }

        setNotices((prev) => prev.filter((notice) => notice.id !== noticeId));

        if (!API_BASE_URL || noticeId.startsWith("n-")) {
          return { ok: true, message: "알림이 삭제되었습니다." };
        }

        try {
          await apiJson<object>(`/api/notices/${encodeURIComponent(noticeId)}`, { method: "DELETE" });
          return { ok: true, message: "알림이 삭제되었습니다." };
        } catch (error) {
          return {
            ok: true,
            message:
              error instanceof Error
                ? `화면에서 삭제했습니다. (서버: ${error.message})`
                : "화면에서 삭제했습니다.",
          };
        }
      },
      deleteAllNotices: async () => {
        setNotices([]);
        if (!API_BASE_URL) {
          return { ok: true, message: "모든 알림을 삭제했습니다." };
        }
        try {
          await apiJson<object>("/api/notices", { method: "DELETE" });
        } catch {
          // 백엔드 일괄 삭제 미지원 시 로컬만 비움
        }
        return { ok: true, message: "모든 알림을 삭제했습니다." };
      },
      markNoticeRead: async (noticeId) => {
        const target = notices.find((notice) => notice.id === noticeId);
        if (!target) {
          return { ok: false, message: "대상 알림을 찾을 수 없습니다." };
        }

        // 낙관적 업데이트
        setNotices((prev) => prev.map((notice) => (notice.id === noticeId ? { ...notice, read: true } : notice)));

        // 프론트 임시 알림(n- prefix)이거나 백엔드 미설정이면 로컬만 처리
        if (!API_BASE_URL || noticeId.startsWith("n-")) {
          return { ok: true, message: "읽음 처리되었습니다." };
        }

        try {
          // PATCH body 없이 호출 (백엔드 스펙: PATCH /api/notices/{id}/read)
          await apiJson<{ message?: string }>(`/api/notices/${noticeId}/read`, {
            method: "PATCH",
          });
          return { ok: true, message: "읽음 처리되었습니다." };
        } catch (error) {
          // 백엔드 실패해도 사용자 경험상 읽음 상태는 유지 (다음 새로고침 때 동기화 시도)
          return {
            ok: true,
            message:
              error instanceof Error
                ? `읽음 처리 (서버 연동 실패: ${error.message})`
                : "읽음 처리 (서버 연동 실패)",
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
    ]
  );

  return <DandiStateContext.Provider value={value}>{children}</DandiStateContext.Provider>;
}

export function useDandiState() {
  const context = useContext(DandiStateContext);
  if (!context) {
    throw new Error("useDandiState must be used within DandiStateProvider");
  }
  return context;
}

export async function fetchAIGuidance(payload: { name: string; category: string; type?: string }) {
  const response = await fetch("/api/ai-guidance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("AI 안내 생성 실패");
  return (await response.json()) as { cautionTitle: string; cautions: string[]; chatbotTips: string[] };
}

export function toKST(iso: string) {
  return formatDateTimeLabel(iso) || iso;
}

export const RUNTIME_TIMESTAMP = nowISO();
