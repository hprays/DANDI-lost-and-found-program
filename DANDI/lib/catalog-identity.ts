import type { PublishedLostItem } from "@/lib/published-lost-items";
import { fetchRemoteLostItems } from "@/lib/catalog-utils";

/** 분실물 PK — 신고 ID와 다를 때 신고 ID가 아닌 lost_item.id를 사용 */
export function canonicalLostItemId(
  primary: PublishedLostItem,
  secondary?: PublishedLostItem | null
): string {
  const candidates = [primary, secondary].filter(Boolean) as PublishedLostItem[];
  for (const item of candidates) {
    const reportId = item.reportId ? String(item.reportId) : "";
    const id = String(item.id);
    if (reportId && reportId !== id) return id;
  }
  for (const item of candidates) {
    const other = item === primary ? secondary : primary;
    if (!other) continue;
    const reportId = item.reportId ? String(item.reportId) : "";
    if (reportId && reportId === String(other.id)) return String(other.id);
  }
  const nums = candidates
    .map((it) => Number(it.id))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (nums.length) return String(Math.max(...nums));
  return String(primary.id);
}

export function normalizeCatalogItemIdentity(item: PublishedLostItem): PublishedLostItem {
  const id = canonicalLostItemId(item);
  const reportId = item.reportId ?? (String(item.id) !== id ? String(item.id) : undefined);
  if (String(item.id) === id && item.reportId === reportId) return item;
  return { ...item, id, reportId: reportId ?? item.reportId };
}

/** PATCH/DELETE용 서버 lost_item PK (신고 ID로 잘못 호출하는 경우 보정) */
export async function resolveServerLostItemId(
  item: PublishedLostItem | undefined,
  hintId: string
): Promise<string> {
  const normalized = normalizeCatalogItemIdentity(
    item ?? { id: hintId, name: "", category: "", place: "", time: "" }
  );
  if (normalized.reportId && String(normalized.reportId) !== String(normalized.id)) {
    return String(normalized.id);
  }

  const remote = await fetchRemoteLostItems();
  const hint = String(hintId);
  const byLost = remote.find((r) => String(r.id) === hint);
  if (byLost) return String(byLost.id);

  const byReport = remote.find(
    (r) => String(r.reportId ?? "") === hint || String(r.id) === hint
  );
  if (byReport) return String(byReport.id);

  return hint;
}
