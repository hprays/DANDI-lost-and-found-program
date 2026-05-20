import { buildings } from "@/lib/mock-data";

const BUILDING_NAMES = new Set(buildings.filter((b) => b !== "전체"));

export type NormalizedReportStatus = "pending" | "resolved" | "picked_up" | "unavailable";

/** 백엔드·DB에 저장된 다양한 상태 문자열을 프론트 표준 상태로 통일합니다. */
export function normalizeReportStatus(raw: unknown): NormalizedReportStatus {
  const token = String(raw ?? "pending")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (["pending", "waiting", "submitted", "reported", "open", "new", "in_review", "review"].includes(token)) {
    return "pending";
  }
  if (["resolved", "found", "acquired", "completed", "approved", "published", "done", "success"].includes(token)) {
    return "resolved";
  }
  if (["picked_up", "pickedup", "collected", "returned", "claimed", "received"].includes(token)) {
    return "picked_up";
  }
  if (["unavailable", "not_found", "notfound", "rejected", "failed", "cancelled", "canceled", "denied"].includes(token)) {
    return "unavailable";
  }
  return "pending";
}

/**
 * ISO·datetime-local 문자열을 한국어 날짜/시간 표기로 변환합니다. (T 제거)
 */
export function formatDateTimeLabel(value: string | undefined | null): string {
  if (!value?.trim()) return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString("ko-KR", { hour12: false });
    }
    return trimmed.replace("T", " ").slice(0, 16);
  }
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString("ko-KR", { hour12: false });
    }
  }
  return trimmed;
}

/**
 * 백엔드가 위치 끝에 '관'을 잘못 붙이는 경우 보정 (예: 인문관 1층 북카페관 → 북카페)
 */
export function sanitizeLocation(location: string | undefined | null): string {
  if (!location?.trim()) return "";
  const trimmed = location.trim();
  if (!trimmed.endsWith("관")) return trimmed;
  if (BUILDING_NAMES.has(trimmed)) return trimmed;

  const withoutTrailing = trimmed.slice(0, -1);
  if (withoutTrailing.includes("관")) {
    return withoutTrailing;
  }
  return trimmed;
}
