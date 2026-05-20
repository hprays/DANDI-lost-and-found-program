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
  return trimmed;
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

/** 카드·목록용 등록·습득 시각 라벨 */
export function displayDateTimeLabels(item: {
  createdAt?: string;
  time?: string;
  foundAt?: string;
}): { registered: string; found: string } {
  const registered =
    formatDateTimeLabel(item.createdAt) || item.createdAt?.trim() || "";
  const found =
    formatDateTimeLabel(item.foundAt ?? item.time) ||
    item.foundAt?.trim() ||
    item.time?.trim() ||
    "";
  return { registered, found };
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
