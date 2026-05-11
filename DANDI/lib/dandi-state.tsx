"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ReportStatus = "pending" | "resolved" | "picked_up" | "unavailable";

export type LostReport = {
  id: string;
  itemName: string;
  category: string;
  lostAt: string;
  location: string;
  memo?: string;
  status: ReportStatus;
  createdAt: string;
  pickedUpAt?: string;
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
  reportId: string;
  token: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
};

type DandiStateContextValue = {
  reports: LostReport[];
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
  issuePickupPass: (reportId: string) => Promise<{ ok: boolean; message: string; token?: string }>;
  verifyPickupPass: (token: string) => Promise<{ ok: boolean; message: string }>;
  deleteReport: (reportId: string) => Promise<{ ok: boolean; message: string }>;
  refreshNotices: () => Promise<void>;
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

  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
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

export function DandiStateProvider({ children }: { children: React.ReactNode }) {
  const [reports, setReports] = useState<LostReport[]>([
    {
      id: "r-1001",
      itemName: "주황색 텀블러",
      category: "기타",
      lostAt: "2026-04-09T09:40",
      location: "혜당관 1층 카페 앞",
      memo: "텀블러 옆면에 DKU 스티커가 있어요.",
      status: "pending",
      createdAt: shortDateTime(),
    },
  ]);

  const [notices, setNotices] = useState<UserNotice[]>([
    {
      id: "n-1001",
      title: "알림 설정이 활성화되었습니다",
      message: "관심 키워드와 일치하는 습득물이 등록되면 바로 알려드려요.",
      createdAt: shortDateTime(),
      read: false,
    },
  ]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [noticesError, setNoticesError] = useState<string | null>(null);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([
    {
      id: "a-1001",
      message: "관리자 대시보드가 초기화되었습니다.",
      createdAt: shortDateTime(),
    },
  ]);
  const [pickupPasses, setPickupPasses] = useState<PickupPass[]>([]);

  const refreshNotices = useCallback(async () => {
    if (!API_BASE_URL) return;
    setNoticesLoading(true);
    setNoticesError(null);
    try {
      const data = await apiJson<UserNotice[]>("/api/notices", { method: "GET" });
      setNotices(Array.isArray(data) ? data : []);
    } catch (error) {
      setNoticesError(error instanceof Error ? error.message : "알림 목록을 불러오지 못했습니다.");
    } finally {
      setNoticesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshNotices();
  }, [refreshNotices]);

  const value = useMemo<DandiStateContextValue>(
    () => ({
      reports,
      notices,
      noticesLoading,
      noticesError,
      apiConfigured: Boolean(API_BASE_URL),
      apiBaseUrl: API_BASE_URL,
      adminAuditLogs,
      pickupPasses,
      submitReport: async (payload) => {
        try {
          const data = await apiJson<{ id?: string; reportId?: string; createdAt?: string; status?: ReportStatus; message?: string }>(
            "/api/reports",
            {
              method: "POST",
              body: JSON.stringify(payload),
            }
          );
          const reportId = data.id ?? data.reportId ?? `r-${Date.now()}`;
          const report: LostReport = {
            id: reportId,
            ...payload,
            status: data.status ?? "pending",
            createdAt: data.createdAt ?? shortDateTime(),
          };
          setReports((prev) => [report, ...prev.filter((it) => it.id !== reportId)]);
          setNotices((prev) => [
            {
              id: `n-${Date.now()}`,
              title: "분실물 신고가 접수되었습니다",
              message: "관리자 확인 후 처리 결과를 알려드릴게요.",
              createdAt: shortDateTime(),
              read: false,
            },
            ...prev,
          ]);
          return { ok: true, message: data.message ?? "신고가 접수되었습니다.", reportId };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "신고 등록에 실패했습니다." };
        }
      },
      resolveReport: async (reportId, status) => {
        try {
          await apiJson<{ message?: string }>(`/api/reports/${reportId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
          });
          setReports((prev) => prev.map((report) => (report.id === reportId ? { ...report, status } : report)));
          setAdminAuditLogs((prev) => [
            {
              id: `a-${Date.now()}`,
              message: `${reportId} 신고건을 ${status === "resolved" ? "습득 완료" : "습득 불가"}로 처리했습니다.`,
              createdAt: shortDateTime(),
            },
            ...prev,
          ]);
          setNotices((prev) => [
            {
              id: `n-${Date.now()}`,
              title: status === "resolved" ? "습득 완료 알림" : "습득 불가 알림",
              message:
                status === "resolved"
                  ? "신고하신 물품이 확인되었습니다. 지도에서 관리실 위치를 확인해 주세요."
                  : "신고하신 물품은 아직 습득되지 않았습니다. 알림은 계속 유지됩니다.",
              createdAt: shortDateTime(),
              read: false,
            },
            ...prev,
          ]);
          return { ok: true, message: "상태 변경이 완료되었습니다." };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "상태 변경에 실패했습니다." };
        }
      },
      issuePickupPass: async (reportId) => {
        const target = reports.find((report) => report.id === reportId);
        if (!target) {
          return { ok: false, message: "해당 신고 항목을 찾을 수 없습니다.", token: undefined };
        }
        if (target.status !== "resolved") {
          return { ok: false, message: "습득 완료 처리된 항목만 QR 발급이 가능합니다.", token: undefined };
        }

        try {
          const data = await apiJson<{ id?: string; token?: string; expiresAt?: string; issuedAt?: string; usedAt?: string | null; message?: string }>(
            "/api/pickup-passes",
            {
              method: "POST",
              body: JSON.stringify({ reportId }),
            }
          );

          const pass: PickupPass = {
            id: data.id ?? `p-${Date.now()}`,
            reportId,
            token: data.token ?? pickupToken(),
            issuedAt: data.issuedAt ?? shortDateTime(),
            expiresAt: data.expiresAt ?? minutesLaterISO(10),
            usedAt: data.usedAt ?? null,
          };

          setPickupPasses((prev) => [pass, ...prev.filter((it) => it.id !== pass.id)]);
          setNotices((prev) => [
            {
              id: `n-${Date.now()}`,
              title: "수령 QR이 발급되었습니다",
              message: "관리실 방문 시 QR 코드를 제시해 최종 수령 인증을 진행해 주세요. (10분 유효)",
              createdAt: shortDateTime(),
              read: false,
            },
            ...prev,
          ]);
          return { ok: true, message: data.message ?? "수령 QR이 발급되었습니다.", token: pass.token };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "수령 QR 발급에 실패했습니다.", token: undefined };
        }
      },
      verifyPickupPass: async (token) => {
        const normalized = token.trim().toUpperCase();
        if (!normalized) {
          return { ok: false, message: "QR 코드를 입력해 주세요." };
        }

        try {
          const data = await apiJson<{ reportId?: string; usedAt?: string; message?: string }>("/api/pickup-passes/verify", {
            method: "POST",
            body: JSON.stringify({ token: normalized }),
          });

          const reportId = data.reportId ?? pickupPasses.find((it) => it.token.toUpperCase() === normalized)?.reportId;
          if (!reportId) {
            return { ok: false, message: "인증 대상 신고건을 찾지 못했습니다." };
          }

          const usedAt = data.usedAt ?? shortDateTime();
          setPickupPasses((prev) =>
            prev.map((it) => (it.token.toUpperCase() === normalized ? { ...it, usedAt } : it))
          );
          setReports((prev) =>
            prev.map((report) => (report.id === reportId ? { ...report, status: "picked_up", pickedUpAt: usedAt } : report))
          );
          setAdminAuditLogs((prev) => [
            {
              id: `a-${Date.now()}`,
              message: `${reportId} 신고건의 QR 수령 인증이 완료되었습니다.`,
              createdAt: usedAt,
            },
            ...prev,
          ]);
          setNotices((prev) => [
            {
              id: `n-${Date.now()}`,
              title: "최종 수령 완료",
              message: "관리실에서 QR 인증이 완료되어 물품 수령이 마무리되었습니다.",
              createdAt: usedAt,
              read: false,
            },
            ...prev,
          ]);
          return { ok: true, message: data.message ?? "QR 인증 완료: 최종 수령 처리되었습니다." };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "QR 인증 처리에 실패했습니다." };
        }
      },
      deleteReport: async (reportId) => {
        try {
          await apiJson<object>(`/api/reports/${reportId}`, { method: "DELETE" });
          setReports((prev) => prev.filter((report) => report.id !== reportId));
          setAdminAuditLogs((prev) => [
            {
              id: `a-${Date.now()}`,
              message: `${reportId} 신고건이 관리자에 의해 삭제되었습니다.`,
              createdAt: shortDateTime(),
            },
            ...prev,
          ]);
          return { ok: true, message: "신고 항목이 삭제되었습니다." };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "신고 항목 삭제에 실패했습니다." };
        }
      },
      refreshNotices,
      markNoticeRead: async (noticeId) => {
        const target = notices.find((notice) => notice.id === noticeId);
        if (!target) {
          return { ok: false, message: "대상 알림을 찾을 수 없습니다." };
        }

        setNotices((prev) => prev.map((notice) => (notice.id === noticeId ? { ...notice, read: true } : notice)));

        if (!API_BASE_URL) {
          return { ok: true, message: "읽음 처리되었습니다." };
        }

        try {
          await apiJson<{ message?: string }>(`/api/notices/${noticeId}/read`, {
            method: "PATCH",
            body: JSON.stringify({ read: true }),
          });
          return { ok: true, message: "읽음 처리되었습니다." };
        } catch (error) {
          setNotices((prev) => prev.map((notice) => (notice.id === noticeId ? { ...notice, read: false } : notice)));
          return { ok: false, message: error instanceof Error ? error.message : "알림 읽음 처리에 실패했습니다." };
        }
      },
    }),
    [
      adminAuditLogs,
      notices,
      noticesError,
      noticesLoading,
      pickupPasses,
      refreshNotices,
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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { hour12: false });
}

export const RUNTIME_TIMESTAMP = nowISO();
