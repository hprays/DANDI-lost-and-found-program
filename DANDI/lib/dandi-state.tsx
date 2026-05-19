"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAuthSession } from "@/lib/auth-session";
import {
  getPublishedLostItems,
  mapApiLostItem,
  removePublishedLostItem,
  reportToPublishedItem,
  setPublishedLostItems,
  upsertPublishedLostItem,
  type PublishedLostItem,
} from "@/lib/published-lost-items";
import { formatDateTimeLabel, sanitizeLocation } from "@/lib/format-display";
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
  notices: UserNotice[];
  noticesLoading: boolean;
  noticesError: string | null;
  apiConfigured: boolean;
  apiBaseUrl: string;
  adminAuditLogs: AdminAuditLog[];
  pickupPasses: PickupPass[];
  submitReport: (payload: Omit<LostReport, "id" | "status" | "createdAt">) => Promise<{ ok: boolean; message: string; reportId?: string }>;
  resolveReport: (
    reportId: string,
    status: Extract<ReportStatus, "resolved" | "unavailable">
  ) => Promise<{ ok: boolean; message: string }>;
  updateHomeLostItem: (itemId: string, patch: Partial<PublishedLostItem>) => void;
  removeHomeLostItem: (itemId: string) => void;
  issuePickupPass: (payload: PickupIssuePayload) => Promise<{ ok: boolean; message: string; token?: string; pass?: PickupPass }>;
  verifyPickupPass: (token: string) => Promise<PickupVerifyResult>;
  deleteReport: (reportId: string) => Promise<{ ok: boolean; message: string }>;
  refreshNotices: () => Promise<void>;
  refreshReports: () => Promise<void>;
  refreshHomeCatalog: () => Promise<void>;
  markNoticeRead: (noticeId: string) => Promise<{ ok: boolean; message: string }>;
};

const DandiStateContext = createContext<DandiStateContextValue | null>(null);
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";

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

function apiUrl(path: string) {
  if (!path.startsWith("/")) return `${API_BASE_URL}/${path}`;
  return `${API_BASE_URL}${path}`;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL 설정이 필요합니다.");
  }

  const session = getAuthSession();
  const authHeader = session?.accessToken
    ? ({
        Authorization: `Bearer ${session.accessToken}`,
      } as Record<string, string>)
    : {};

  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let serverMessage = "요청 처리에 실패했습니다.";
    try {
      const err = (await response.json()) as { message?: string; error?: string };
      serverMessage = err.message || err.error || serverMessage;
    } catch {
      // ignore json parsing errors
    }
    if (response.status === 404 && serverMessage === "요청 처리에 실패했습니다.") {
      serverMessage = `엔드포인트를 찾을 수 없습니다: ${path}`;
    }
    throw new Error(serverMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

function normalizeReport(raw: Record<string, unknown>): LostReport | null {
  const id = raw.id ?? raw.reportId;
  const itemName = raw.itemName ?? raw.name;
  if (id == null || itemName == null) return null;
  const status = (raw.status as ReportStatus) ?? "pending";
  return {
    id: String(id),
    itemName: String(itemName),
    category: String(raw.category ?? "기타"),
    lostAt: formatDateTimeLabel(String(raw.lostAt ?? raw.foundAt ?? "")),
    location: sanitizeLocation(String(raw.location ?? raw.place ?? "")),
    memo: raw.memo != null ? String(raw.memo) : undefined,
    image: raw.image != null ? String(raw.image) : undefined,
    itemType: raw.itemType != null ? String(raw.itemType) : raw.type != null ? String(raw.type) : undefined,
    storage: raw.storage != null ? String(raw.storage) : undefined,
    status,
    createdAt: String(raw.createdAt ?? shortDateTime()),
    pickedUpAt: raw.pickedUpAt != null ? String(raw.pickedUpAt) : undefined,
    ownerEmail: raw.ownerEmail != null ? String(raw.ownerEmail) : undefined,
    ownerName: raw.ownerName != null ? String(raw.ownerName) : undefined,
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

function extractLostItemList(payload: unknown): PublishedLostItem[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as { content?: unknown[]; data?: unknown[]; items?: unknown[] }).content ??
        (payload as { data?: unknown[] }).data ??
        (payload as { items?: unknown[] }).items ??
        [])
      : [];
  return list
    .map((row) => mapApiLostItem(row as Record<string, unknown>))
    .filter((row): row is PublishedLostItem => row !== null);
}

async function publishLostItemToApi(report: LostReport) {
  if (!API_BASE_URL) return;
  await apiJson<{ id?: string; lostItemId?: string; message?: string }>("/api/lost-items", {
    method: "POST",
    body: JSON.stringify({
      reportId: report.id,
      name: report.itemName,
      itemName: report.itemName,
      category: report.category,
      location: report.location,
      place: report.location,
      lostAt: report.lostAt,
      foundAt: report.lostAt,
      memo: report.memo,
      itemType: report.itemType,
      storage: report.storage,
      image: report.image,
    }),
  });
}

export function DandiStateProvider({ children }: { children: React.ReactNode }) {
  const [reports, setReports] = useState<LostReport[]>([]);
  const [homeLostItems, setHomeLostItems] = useState<PublishedLostItem[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(0);

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
  const [pickupPasses, setPickupPasses] = useState<PickupPass[]>([]);

  const applyCatalogMerge = useCallback((reportList: LostReport[], remoteItems: PublishedLostItem[] = []) => {
    const resolvedPublished = reportList.filter((r) => r.status === "resolved").map(reportToPublishedItem);
    const localPublished = getPublishedLostItems();
    const merged = new Map<string, PublishedLostItem>();
    remoteItems.forEach((item) => merged.set(item.id, item));
    localPublished.forEach((item) => merged.set(item.id, item));
    resolvedPublished.forEach((item) => merged.set(item.id, item));
    const next = Array.from(merged.values());
    setPublishedLostItems(next);
    setHomeLostItems(next);
    setCatalogVersion((v) => v + 1);
  }, []);

  const refreshHomeCatalog = useCallback(async () => {
    let remoteItems: PublishedLostItem[] = [];
    if (API_BASE_URL) {
      try {
        remoteItems = extractLostItemList(await apiJson<unknown>("/api/lost-items", { method: "GET" }));
      } catch {
        try {
          remoteItems = extractLostItemList(await apiJson<unknown>("/lost-items", { method: "GET" }));
        } catch {
          remoteItems = [];
        }
      }
    }
    setReports((current) => {
      applyCatalogMerge(current, remoteItems);
      return current;
    });
  }, [applyCatalogMerge]);

  const refreshReports = useCallback(async () => {
    if (!API_BASE_URL) return;
    try {
      const remote = extractReportList(await apiJson<unknown>("/api/reports", { method: "GET" }));
      setReports((prev) => {
        const map = new Map<string, LostReport>();
        prev.forEach((r) => map.set(r.id, r));
        remote.forEach((r) => map.set(r.id, r));
        const merged = Array.from(map.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        applyCatalogMerge(merged, []);
        return merged;
      });
    } catch {
      // GET 미지원 백엔드는 로컬 reports 유지
    }
  }, [applyCatalogMerge]);

  const refreshNotices = useCallback(async () => {
    if (!API_BASE_URL) return;
    setNoticesLoading(true);
    setNoticesError(null);
    try {
      const data = await apiJson<UserNotice[]>("/api/notices", { method: "GET" });
      const remote = Array.isArray(data) ? data : [];
      // 로컬 알림(n- prefix)은 새로고침 후에도 유지되도록 백엔드 응답과 병합
      setNotices((prev) => {
        const localOnly = prev.filter((it) => it.id.startsWith("n-"));
        const merged = [...remote, ...localOnly];
        // id 중복 제거 (백엔드 우선)
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

  useEffect(() => {
    void refreshNotices();
    void refreshReports();
    void refreshHomeCatalog();
  }, [refreshNotices, refreshReports, refreshHomeCatalog]);

  const value = useMemo<DandiStateContextValue>(
    () => ({
      reports,
      homeLostItems,
      catalogVersion,
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
        const ownerName = session?.name;
        const normalizedPayload = {
          ...payload,
          location: sanitizeLocation(payload.location),
          lostAt: formatDateTimeLabel(payload.lostAt) || payload.lostAt,
          storage: payload.storage ? sanitizeLocation(payload.storage) : payload.storage,
        };
        try {
          const data = await apiJson<{ id?: string; reportId?: string; createdAt?: string; status?: ReportStatus; message?: string }>(
            "/api/reports",
            {
              method: "POST",
              body: JSON.stringify({ ...normalizedPayload, ownerEmail, ownerName }),
            }
          );
          const reportId = data.id ?? data.reportId ?? `r-${Date.now()}`;
          const report: LostReport = {
            id: reportId,
            ...normalizedPayload,
            status: data.status ?? "pending",
            createdAt: formatDateTimeLabel(data.createdAt ?? "") || shortDateTime(),
            ownerEmail,
            ownerName,
          };
          setReports((prev) => {
            const next = [report, ...prev.filter((it) => it.id !== reportId)];
            applyCatalogMerge(next, []);
            return next;
          });
          void refreshNotices();
          return { ok: true, message: data.message ?? "신고가 접수되었습니다.", reportId };
        } catch (error) {
          const fallbackReportId = `r-local-${Date.now()}`;
          const fallbackReport: LostReport = {
            id: fallbackReportId,
            ...normalizedPayload,
            status: "pending",
            createdAt: shortDateTime(),
            ownerEmail,
            ownerName,
          };
          setReports((prev) => {
            const next = [fallbackReport, ...prev.filter((it) => it.id !== fallbackReportId)];
            applyCatalogMerge(next, []);
            return next;
          });
          return {
            ok: false,
            message:
              error instanceof Error
                ? `신고 접수에 실패했습니다. (${error.message})`
                : "신고 접수에 실패했습니다.",
            reportId: fallbackReportId,
          };
        }
      },
      resolveReport: async (reportId, status) => {
        const applyResolved = async (fromBackend: boolean) => {
          let updatedReport: LostReport | null = null;
          setReports((prev) => {
            const sourceReport = prev.find((report) => report.id === reportId);
            if (!sourceReport) return prev;
            updatedReport = { ...sourceReport, status };
            const next = prev.map((report) => (report.id === reportId ? updatedReport! : report));
            if (status === "resolved") {
              upsertPublishedLostItem(reportToPublishedItem(updatedReport));
            } else {
              removePublishedLostItem(reportId);
            }
            applyCatalogMerge(next, []);
            return next;
          });
          if (status === "resolved" && updatedReport && fromBackend) {
            try {
              await publishLostItemToApi(updatedReport);
              await refreshHomeCatalog();
            } catch {
              // 백엔드 lost-items 미구현 시 로컬 카탈로그만 유지
            }
          }
          setAdminAuditLogs((prev) => [
            {
              id: `a-${Date.now()}`,
              message: `${reportId} 신고건을 ${status === "resolved" ? "습득 완료" : "습득 불가"}로 처리했습니다.`,
              createdAt: shortDateTime(),
            },
            ...prev,
          ]);
          await refreshNotices();
        };

        try {
          await apiJson<{ message?: string }>(`/api/reports/${reportId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
          });
          await applyResolved(true);
          return { ok: true, message: "상태 변경이 완료되었습니다. 홈 목록에 반영되었습니다." };
        } catch (error) {
          if (!API_BASE_URL) {
            await applyResolved(false);
            return { ok: true, message: "상태 변경이 완료되었습니다." };
          }
          return {
            ok: false,
            message: error instanceof Error ? error.message : "상태 변경에 실패했습니다.",
          };
        }
      },
      updateHomeLostItem: (itemId, patch) => {
        const current = getPublishedLostItems();
        const target = current.find((it) => it.id === itemId) ?? homeLostItems.find((it) => it.id === itemId);
        if (!target) return;
        const updated = { ...target, ...patch };
        upsertPublishedLostItem(updated);
        setHomeLostItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
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
              foundAt: updated.time,
              memo: updated.memo,
              itemType: updated.type,
              storage: updated.storage,
              image: updated.image,
            }),
          }).catch(() => undefined);
        }
      },
      removeHomeLostItem: (itemId) => {
        removePublishedLostItem(itemId);
        setHomeLostItems((prev) => prev.filter((it) => it.id !== itemId));
        setCatalogVersion((v) => v + 1);
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
        const normalized = token.trim().toUpperCase();
        if (!normalized) {
          return { ok: false, message: "QR 코드를 입력해 주세요." };
        }

        const finalize = (pass: PickupPass, usedAt: string, message: string): PickupVerifyResult => {
          setPickupPasses((prev) =>
            prev.map((it) => (it.token.toUpperCase() === normalized ? { ...it, usedAt } : it))
          );
          if (pass.reportId) {
            setReports((prev) => {
              const next = prev.map((report) =>
                report.id === pass.reportId ? { ...report, status: "picked_up", pickedUpAt: usedAt } : report
              );
              removePublishedLostItem(pass.reportId);
              applyCatalogMerge(next, []);
              return next;
            });
          }
          if (pass.lostItemId) {
            removePublishedLostItem(pass.lostItemId);
            setHomeLostItems((prev) => prev.filter((it) => it.id !== pass.lostItemId));
            setCatalogVersion((v) => v + 1);
          }
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

        const localPass = pickupPasses.find((it) => it.token.toUpperCase() === normalized);

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
          return finalize(merged, usedAt, data.message ?? "QR 인증 완료: 최종 수령 처리되었습니다.");
        } catch (error) {
          if (!localPass) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "QR 인증 처리에 실패했습니다.",
            };
          }
          const usedAt = shortDateTime();
          return finalize(
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
          await apiJson<object>(`/api/reports/${reportId}`, { method: "DELETE" });
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
      refreshHomeCatalog,
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
      catalogVersion,
      homeLostItems,
      notices,
      noticesError,
      noticesLoading,
      pickupPasses,
      refreshHomeCatalog,
      refreshNotices,
      refreshReports,
      reports,
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
