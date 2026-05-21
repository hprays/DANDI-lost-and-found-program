import { buildings } from '@/lib/mock-data';

const BUILDING_NAMES = new Set(buildings.filter((b) => b !== '전체'));

export type NormalizedReportStatus =
  | 'pending'
  | 'resolved'
  | 'picked_up'
  | 'unavailable';

/** 백엔드·DB에 저장된 다양한 상태 문자열을 프론트 표준 상태로 통일합니다. */
export function normalizeReportStatus(raw: unknown): NormalizedReportStatus {
  const token = String(raw ?? 'pending')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (
    [
      'pending',
      'waiting',
      'submitted',
      'reported',
      'open',
      'new',
      'in_review',
      'review',
    ].includes(token)
  ) {
    return 'pending';
  }
  if (
    [
      'resolved',
      'found',
      'acquired',
      'completed',
      'approved',
      'published',
      'done',
      'success',
    ].includes(token)
  ) {
    return 'resolved';
  }
  if (
    [
      'picked_up',
      'pickedup',
      'collected',
      'returned',
      'claimed',
      'received',
    ].includes(token)
  ) {
    return 'picked_up';
  }
  if (
    [
      'unavailable',
      'not_found',
      'notfound',
      'rejected',
      'failed',
      'cancelled',
      'canceled',
      'denied',
    ].includes(token)
  ) {
    return 'unavailable';
  }
  return 'pending';
}

/**
 * ISO·datetime-local 문자열을 한국어 날짜/시간 표기로 변환합니다. (T 제거)
 */
export function formatDateTimeLabel(value: string | undefined | null): string {
  if (!value?.trim()) return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString('ko-KR', { hour12: false });
    }
    return trimmed.replace('T', ' ').slice(0, 16);
  }
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString('ko-KR', { hour12: false });
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }
  return trimmed;
}

/** datetime-local 입력용 (관리자 습득 시간) */
export function toDatetimeLocalValue(timeStr: string | undefined | null): string {
  if (!timeStr?.trim()) return '';
  const trimmed = timeStr.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) return trimmed.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T00:00`;
  const ms = parseDateTimeMs(trimmed);
  if (ms > 0) {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function hasTimeDetail(value: string | undefined | null): boolean {
  if (!value?.trim()) return false;
  const t = value.trim();
  return /T\d{2}:\d{2}/.test(t) || /\d{1,2}:\d{2}/.test(t) || /\d{1,2}시/.test(t);
}

/** API가 날짜만 줄 때 로컬에 저장된 상세 시각 유지 */
export function pickRicherDateTimeLabel(
  primary?: string | null,
  secondary?: string | null
): string | undefined {
  const a = primary?.trim();
  const b = secondary?.trim();
  if (!a && !b) return undefined;
  if (a && b) {
    if (hasTimeDetail(a) && !hasTimeDetail(b)) return formatDateTimeLabel(a) || a;
    if (hasTimeDetail(b) && !hasTimeDetail(a)) return formatDateTimeLabel(b) || b;
    const msA = parseDateTimeMs(a);
    const msB = parseDateTimeMs(b);
    if (msA >= msB) return formatDateTimeLabel(a) || a;
    return formatDateTimeLabel(b) || b;
  }
  const only = a || b;
  return only ? formatDateTimeLabel(only) || only : undefined;
}

/** datetime-local·한국어 표기·ISO를 밀리초로 변환 (정렬용) */
export function parseDateTimeMs(value: string | undefined | null): number {
  if (!value?.trim()) return 0;
  const trimmed = value.trim();
  const direct = Date.parse(trimmed);
  if (!Number.isNaN(direct) && direct > 0) return direct;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();

  const koDetailed = trimmed.match(
    /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})(?:\.\s*|\s+)(\d{1,2})시\s*(\d{1,2})분(?:\s*(\d{1,2})초)?/
  );
  if (koDetailed) {
    return new Date(
      Number(koDetailed[1]),
      Number(koDetailed[2]) - 1,
      Number(koDetailed[3]),
      Number(koDetailed[4]),
      Number(koDetailed[5]),
      Number(koDetailed[6] ?? 0)
    ).getTime();
  }

  const koColon = trimmed.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{1,2}):(\d{1,2}):(\d{1,2})/);
  if (koColon) {
    return new Date(
      Number(koColon[1]),
      Number(koColon[2]) - 1,
      Number(koColon[3]),
      Number(koColon[4]),
      Number(koColon[5]),
      Number(koColon[6])
    ).getTime();
  }

  return 0;
}

/** API 저장용 ISO 문자열 */
export function toApiDateTime(value: string | undefined | null): string {
  if (!value?.trim()) return new Date().toISOString();
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const ms = parseDateTimeMs(trimmed);
  if (ms > 0) return new Date(ms).toISOString();
  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) return fallback.toISOString();
  return new Date().toISOString();
}

/** 상세·관리 화면용 등록(created_at) 시각 — 습득은 별도 표시 */
export function displayRegistrationDateTime(item: {
  createdAt?: string | null;
  time?: string | null;
}): string {
  const raw = item.createdAt?.trim();
  if (!raw) return "";
  return formatDateTimeLabel(raw) || raw;
}

/** 상세 화면용 습득 시각 (등록과 다를 때만) */
export function displayFoundDateTime(item: {
  foundAt?: string | null;
  time?: string | null;
  createdAt?: string | null;
}): string {
  const foundRaw = (item.foundAt ?? item.time)?.trim();
  if (!foundRaw) return "";
  const found = formatDateTimeLabel(foundRaw) || foundRaw;
  const registered = displayRegistrationDateTime(item);
  if (registered && found === registered) return "";
  return found;
}

/** @deprecated 상세는 displayRegistrationDateTime / displayFoundDateTime 사용 */
export function displayDateTimeLabels(item: {
  createdAt?: string;
  time?: string;
  foundAt?: string;
}): { registered: string; found: string } {
  const registered = displayRegistrationDateTime(item);
  const found = displayFoundDateTime(item);
  return { registered, found };
}

/** 홈·검색 카드용 등록일(날짜만) — createdAt 우선, 없으면 날짜 정보 없음 */
export function formatCatalogCardDate(item: { createdAt?: string; time?: string }): string {
  const raw = item.createdAt?.trim();
  if (!raw) return "날짜 정보 없음";
  const ms = parseDateTimeMs(raw);
  if (ms > 0) {
    return new Date(ms).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  const labeled = formatDateTimeLabel(raw) || raw;
  const dateOnly = labeled.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (dateOnly) return `${dateOnly[1]}. ${dateOnly[2]}. ${dateOnly[3]}.`;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return labeled;
}

/** @deprecated formatCatalogCardDate 사용 */
export function formatCatalogTimeLine(item: { createdAt?: string }): string {
  return formatCatalogCardDate(item);
}

/**
 * 백엔드가 위치 끝에 '관'을 잘못 붙이는 경우 보정 (예: 인문관 1층 북카페관 → 북카페)
 */
export function sanitizeLocation(location: string | undefined | null): string {
  if (!location?.trim()) return '';
  const trimmed = location.trim();
  if (!trimmed.endsWith('관')) return trimmed;
  if (BUILDING_NAMES.has(trimmed)) return trimmed;

  const withoutTrailing = trimmed.slice(0, -1);
  if (withoutTrailing.includes('관')) {
    return withoutTrailing;
  }
  return trimmed;
}
