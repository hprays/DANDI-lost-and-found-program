// 외부 import 없는 순수 함수 — scripts/check-item-filters.mjs에서 바로 실행해 확인한다

export const PERIOD_FILTERS = ["전체", "오늘", "이번 주", "이번 달"] as const;
export type PeriodFilter = (typeof PERIOD_FILTERS)[number];

export const STATUS_FILTERS = ["전체", "수령 가능", "수령 완료"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** 기간 필터의 시작 시각(ms). "전체"는 0 — 이번 주는 월요일 0시부터 */
export function periodStartMs(period: PeriodFilter, now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === "오늘") return d.getTime();
  if (period === "이번 주") {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }
  if (period === "이번 달") {
    d.setDate(1);
    return d.getTime();
  }
  return 0;
}

const compact = (value: string) => value.replace(/\s+/g, "").toLowerCase();

/** 보관 장소 문자열에 맞는 관리실 — 이름 > 호실 > 건물 순으로 비교 */
export function findOfficeForStorage<T extends { name: string; location: string; address: string }>(
  storage: string | undefined,
  offices: readonly T[]
): T | undefined {
  const target = compact(storage ?? "");
  if (!target) return undefined;
  return (
    offices.find((o) => target.includes(compact(o.name))) ??
    offices.find((o) => target.includes(compact(o.location))) ??
    offices.find((o) => target.includes(compact(o.address)))
  );
}

/** 남은 시간 "9분 05초" (0 이하면 "0분 00초") */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}분 ${String(total % 60).padStart(2, "0")}초`;
}

type OfficeLike = { name: string; location: string };

/** 건물에 있는 관리실 — 관리실 이름이 건물 이름으로 시작하는 것 */
export function officeForBuilding<T extends OfficeLike>(building: string, offices: readonly T[]): T | undefined {
  const target = compact(building);
  if (!target) return undefined;
  return offices.find((o) => compact(o.name).startsWith(target));
}

/** 보관 장소 문구 "혜당관 학생팀 425호" — 호실 앞의 건물명이 이름과 겹치면 한 번만 쓴다 */
export function officeStorageLabel(office: OfficeLike): string {
  const name = office.name.replace("(", " (");
  const [first, ...rest] = office.location.split(" ");
  return name.includes(first) && rest.length > 0 ? `${name} ${rest.join(" ")}` : `${name} ${office.location}`;
}
