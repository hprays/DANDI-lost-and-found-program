import type { PublishedLostItem } from "@/lib/published-lost-items";

/**
 * 카탈로그 항목 식별 규칙
 * - lostItemId: lost_item PK. 숫자 id를 가진 항목은 id === lostItemId.
 * - reportId: report PK. lost_item과 별개 테이블이라 숫자가 같아도 서로 연결하지 않는다.
 * - 승인 전 임시 카드는 id가 `report-<reportId>` 라서 숫자 id와 겹치지 않는다.
 */
type CatalogIdentity = Pick<PublishedLostItem, "id" | "lostItemId" | "reportId">;

const isNumeric = (value?: string | null) => /^\d+$/.test(String(value ?? "").trim());

/** lost_item PK (없으면 undefined) */
export function lostItemPk(item: CatalogIdentity): string | undefined {
  if (isNumeric(item.lostItemId)) return String(item.lostItemId).trim();
  if (isNumeric(item.id)) return String(item.id).trim();
  return undefined;
}

/** 같은 종류의 ID끼리만 비교한다 (lost_item ↔ lost_item, report ↔ report). */
export function catalogIdentityKeys(item: CatalogIdentity): string[] {
  const keys = [`id:${String(item.id)}`];
  const pk = lostItemPk(item);
  if (pk) keys.push(`lost:${pk}`);
  const reportId = String(item.reportId ?? "").trim();
  if (reportId) keys.push(`report:${reportId}`);
  return keys;
}

export function isSameCatalogItem(a: CatalogIdentity, b: CatalogIdentity): boolean {
  const aPk = lostItemPk(a);
  const bPk = lostItemPk(b);
  // 서로 다른 lost_item PK면 reportId가 같아도 다른 물품
  if (aPk && bPk) return aPk === bPk;
  if (String(a.id) === String(b.id)) return true;
  const aReport = String(a.reportId ?? "").trim();
  return Boolean(aReport) && aReport === String(b.reportId ?? "").trim();
}

export function normalizeCatalogItemIdentity(item: PublishedLostItem): PublishedLostItem {
  const pk = lostItemPk(item);
  if (!pk || (String(item.id) === pk && item.lostItemId === pk)) return item;
  return { ...item, id: pk, lostItemId: pk };
}

/** 화면 경로·버튼의 id(= item.id)로 항목 찾기. reportId와는 비교하지 않는다. */
export function findCatalogItemByHint(
  hintId: string,
  pools: PublishedLostItem[]
): PublishedLostItem | undefined {
  const hint = String(hintId).trim();
  if (!hint) return undefined;
  return pools.find((item) => String(item.id) === hint || lostItemPk(item) === hint);
}

/** PATCH/DELETE·수령 QR용 lost_item 숫자 PK. 서버 물품이 아니면 빈 문자열. */
export function resolveServerLostItemId(
  item: PublishedLostItem | undefined,
  hintId: string,
  lookupItems: PublishedLostItem[] = []
): string {
  const target = item ?? findCatalogItemByHint(hintId, lookupItems);
  if (!target) return isNumeric(hintId) ? String(hintId).trim() : "";
  const pk = lostItemPk(target);
  if (pk) return pk;
  // 승인 직후 임시 카드: 같은 신고에서 생성된 서버 물품을 찾는다
  const reportId = String(target.reportId ?? "").trim();
  if (!reportId) return "";
  const linked = lookupItems.find(
    (it) => String(it.reportId ?? "").trim() === reportId && lostItemPk(it)
  );
  return linked ? (lostItemPk(linked) as string) : "";
}
