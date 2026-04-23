"use client";

import { createContext, useContext, useMemo, useState } from "react";

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
  apiConfigured: boolean;
  apiBaseUrl: string;
  adminVerified: boolean;
  adminOtpRequestedAt: string | null;
  adminAuditLogs: AdminAuditLog[];
  pickupPasses: PickupPass[];
  requestAdminOtp: (adminCode: string) => { ok: boolean; message: string; demoOtp?: string };
  verifyAdminOtp: (otp: string) => { ok: boolean; message: string };
  logoutAdmin: () => void;
  submitReport: (payload: Omit<LostReport, "id" | "status" | "createdAt">) => Promise<{ ok: boolean; message: string; reportId?: string }>;
  resolveReport: (
    reportId: string,
    status: Extract<ReportStatus, "resolved" | "unavailable">
  ) => Promise<{ ok: boolean; message: string }>;
  issuePickupPass: (reportId: string) => Promise<{ ok: boolean; message: string; token?: string }>;
  verifyPickupPass: (token: string) => Promise<{ ok: boolean; message: string }>;
  deleteReport: (reportId: string) => Promise<{ ok: boolean; message: string }>;
  markNoticeRead: (noticeId: string) => void;
};

const DandiStateContext = createContext<DandiStateContextValue | null>(null);
const ADMIN_MASTER_CODE = "DKU-ADMIN-2026";
const ADMIN_UI_TEST_MODE = process.env.NEXT_PUBLIC_ADMIN_UI_TEST_MODE !== "false";
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
  const [adminVerified, setAdminVerified] = useState(false);
  const [adminOtpRequestedAt, setAdminOtpRequestedAt] = useState<string | null>(null);
  const [pendingAdminOtp, setPendingAdminOtp] = useState<string | null>(null);
  const [adminOtpTryCount, setAdminOtpTryCount] = useState(0);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([
    {
      id: "a-1001",
      message: "관리자 대시보드가 초기화되었습니다.",
      createdAt: shortDateTime(),
    },
  ]);
  const [pickupPasses, setPickupPasses] = useState<PickupPass[]>([]);

  const value = useMemo<DandiStateContextValue>(
    () => ({
      reports,
      notices,
      apiConfigured: Boolean(API_BASE_URL),
      apiBaseUrl: API_BASE_URL,
      adminVerified,
      adminOtpRequestedAt,
      adminAuditLogs,
      pickupPasses,
      requestAdminOtp: (adminCode) => {
        if (ADMIN_UI_TEST_MODE) {
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          setPendingAdminOtp(otp);
          setAdminOtpRequestedAt(shortDateTime());
          setAdminOtpTryCount(0);
          setAdminAuditLogs((prev) => [
            {
              id: `a-${Date.now()}`,
              message: "관리자 OTP 인증 요청이 생성되었습니다.",
              createdAt: shortDateTime(),
            },
            ...prev,
          ]);
          return {
            ok: true,
            message: "OTP가 발급되었습니다. 인증번호를 확인해 입력해 주세요.",
            demoOtp: otp,
          };
        }

        if (adminCode.trim() !== ADMIN_MASTER_CODE) {
          return { ok: false, message: "관리자 인증번호가 올바르지 않습니다." };
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        setPendingAdminOtp(otp);
        setAdminOtpRequestedAt(shortDateTime());
        setAdminOtpTryCount(0);
        setAdminAuditLogs((prev) => [
          {
            id: `a-${Date.now()}`,
            message: "관리자 OTP 인증 요청이 생성되었습니다.",
            createdAt: shortDateTime(),
          },
          ...prev,
        ]);
        return { ok: true, message: "OTP가 발급되었습니다. 관리자에게 전달된 번호를 입력해 주세요.", demoOtp: otp };
      },
      verifyAdminOtp: (otp) => {
        if (ADMIN_UI_TEST_MODE) {
          if (!adminOtpRequestedAt) {
            setAdminOtpRequestedAt(shortDateTime());
          }
          setAdminVerified(true);
          setPendingAdminOtp(null);
          setAdminAuditLogs((prev) => [
            {
              id: `a-${Date.now()}`,
              message: `관리자 OTP 인증 처리 (${otp || "빈 값"}).`,
              createdAt: shortDateTime(),
            },
            ...prev,
          ]);
          return { ok: true, message: "관리자 인증이 완료되었습니다." };
        }

        if (!pendingAdminOtp) {
          return { ok: false, message: "먼저 OTP를 요청해 주세요." };
        }
        if (adminOtpTryCount >= 5) {
          setPendingAdminOtp(null);
          return { ok: false, message: "OTP 시도 횟수를 초과했습니다. 다시 요청해 주세요." };
        }

        if (otp.trim() !== pendingAdminOtp) {
          setAdminOtpTryCount((prev) => prev + 1);
          return { ok: false, message: "OTP가 일치하지 않습니다." };
        }

        setAdminVerified(true);
        setPendingAdminOtp(null);
        setAdminAuditLogs((prev) => [
          {
            id: `a-${Date.now()}`,
            message: "관리자 OTP 인증이 완료되었습니다.",
            createdAt: shortDateTime(),
          },
          ...prev,
        ]);
        return { ok: true, message: "관리자 인증이 완료되었습니다." };
      },
      logoutAdmin: () => {
        setAdminVerified(false);
        setPendingAdminOtp(null);
        setAdminOtpRequestedAt(null);
        setAdminAuditLogs((prev) => [
          {
            id: `a-${Date.now()}`,
            message: "관리자 세션이 로그아웃되었습니다.",
            createdAt: shortDateTime(),
          },
          ...prev,
        ]);
      },
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
      markNoticeRead: (noticeId) => {
        setNotices((prev) => prev.map((notice) => (notice.id === noticeId ? { ...notice, read: true } : notice)));
      },
    }),
    [adminAuditLogs, adminOtpRequestedAt, adminOtpTryCount, adminVerified, notices, pendingAdminOtp, pickupPasses, reports]
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
