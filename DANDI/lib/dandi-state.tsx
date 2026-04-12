"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type ReportStatus = "pending" | "resolved" | "unavailable";

export type LostReport = {
  id: string;
  itemName: string;
  category: string;
  lostAt: string;
  location: string;
  memo?: string;
  status: ReportStatus;
  createdAt: string;
};

export type UserNotice = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

type DandiStateContextValue = {
  reports: LostReport[];
  notices: UserNotice[];
  submitReport: (payload: Omit<LostReport, "id" | "status" | "createdAt">) => string;
  resolveReport: (reportId: string, status: Extract<ReportStatus, "resolved" | "unavailable">) => void;
  deleteReport: (reportId: string) => void;
  markNoticeRead: (noticeId: string) => void;
};

const DandiStateContext = createContext<DandiStateContextValue | null>(null);

function nowISO() {
  return new Date().toISOString();
}

function shortDateTime() {
  return new Date().toLocaleString("ko-KR", { hour12: false });
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

  const value = useMemo<DandiStateContextValue>(
    () => ({
      reports,
      notices,
      submitReport: (payload) => {
        const reportId = `r-${Date.now()}`;
        const report: LostReport = {
          id: reportId,
          ...payload,
          status: "pending",
          createdAt: shortDateTime(),
        };
        setReports((prev) => [report, ...prev]);
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
        return reportId;
      },
      resolveReport: (reportId, status) => {
        setReports((prev) => prev.map((report) => (report.id === reportId ? { ...report, status } : report)));
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
      },
      deleteReport: (reportId) => {
        setReports((prev) => prev.filter((report) => report.id !== reportId));
      },
      markNoticeRead: (noticeId) => {
        setNotices((prev) => prev.map((notice) => (notice.id === noticeId ? { ...notice, read: true } : notice)));
      },
    }),
    [notices, reports]
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
