import type { PublishedLostItem } from "@/lib/published-lost-items";

function isLostItemPkRow(item: PublishedLostItem): boolean {
  const id = String(item.id);
  const reportId = item.reportId ? String(item.reportId) : "";
  return /^\d+$/.test(id) && (!reportId || reportId !== id);
}

/** 분실물 PK — API lost_item.id 우선 (신고 id로 덮지 않음) */
export function canonicalLostItemId(
  primary: PublishedLostItem,
  secondary?: PublishedLostItem | null
): string {
  const candidates = [primary, secondary].filter(Boolean) as PublishedLostItem[];
  const lostRows = candidates.filter(isLostItemPkRow);
  if (lostRows.length) {
    const nums = lostRows.map((it) => Number(it.id)).filter((n) => !Number.isNaN(n));
    return String(Math.max(...nums));
  }
  for (const item of candidates) {
    const reportId = item.reportId ? String(item.reportId) : "";
    const id = String(item.id);
    if (reportId && reportId !== id && /^\d+$/.test(id)) return id;
  }
  const nums = candidates.map((it) => Number(it.id)).filter((n) => !Number.isNaN(n) && n > 0);
  if (nums.length) return String(Math.max(...nums));
  return String(primary.id);
}

export function normalizeCatalogItemIdentity(item: PublishedLostItem): PublishedLostItem {
  const id = isLostItemPkRow(item)
    ? String(item.id)
    : item.lostItemId && /^\d+$/.test(String(item.lostItemId))
      ? String(item.lostItemId)
      : /^\d+$/.test(String(item.id))
        ? String(item.id)
        : String(item.id);
  const reportId =
    item.reportId ??
    (String(item.id) !== id && /^\d+$/.test(String(item.id)) === false ? String(item.id) : undefined);
  const lostItemId = /^\d+$/.test(id) ? id : item.lostItemId;
  if (String(item.id) === id && item.reportId === reportId && item.lostItemId === lostItemId) {
    return item;
  }
  return { ...item, id, lostItemId: lostItemId ?? (/^\d+$/.test(id) ? id : undefined), reportId };
}

/** PATCH/DELETE·수령 QR용 lost_item 숫자 PK */
export function resolveServerLostItemId(
  item: PublishedLostItem | undefined,
  hintId: string,
  lookupItems: PublishedLostItem[] = []
): string {
  const stub = item ?? { id: hintId, name: "", category: "", place: "", time: "" };
  const normalized = normalizeCatalogItemIdentity(stub);
  if (normalized.lostItemId && /^\d+$/.test(String(normalized.lostItemId))) {
    return String(normalized.lostItemId);
  }
  if (normalized.reportId && String(normalized.reportId) !== String(normalized.id)) {
    return String(normalized.id);
  }

  const hint = String(hintId);
  const byLost = lookupItems.find((r) => String(r.id) === hint || String(r.lostItemId) === hint);
  if (byLost) return String(byLost.lostItemId ?? byLost.id);

  const byReport = lookupItems.find(
    (r) => String(r.reportId ?? "") === hint && /^\d+$/.test(String(r.id))
  );
  if (byReport) return String(byReport.lostItemId ?? byReport.id);

  if (/^\d+$/.test(hint)) return hint;
  return String(normalized.id);
}
