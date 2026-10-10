import type { PublishedLostItem } from "@/lib/published-lost-items";
import { mapApiLostItem } from "@/lib/published-lost-items";
import {
  getCachedRemoteLostItems,
  invalidateRemoteLostItemsCache,
  setCachedRemoteLostItems,
} from "@/lib/catalog-cache";
import { apiJson } from "@/lib/api-json";
import { getApiBaseUrl } from "@/lib/api-json";
import { parseDateTimeMs } from "@/lib/format-display";

export { invalidateRemoteLostItemsCache };

export async function fetchLostItemById(id: string): Promise<PublishedLostItem | null> {
  const base = getApiBaseUrl();
  if (!base || !id.trim()) return null;
  const encoded = encodeURIComponent(id.trim());
  try {
    const data = await apiJson<unknown>(`/api/lost-items/${encoded}`, { method: "GET" });
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const row = data as Record<string, unknown>;
      return mapApiLostItem({ ...row, id: row.id ?? row.lostItemId ?? id });
    }
    return extractLostItemList(data)[0] ?? null;
  } catch {
    return null;
  }
}

/** 실패는 그대로 던진다 — 호출 측이 빈 목록과 조회 실패를 구분해야 한다 */
async function fetchRemoteLostItemsFromNetwork(): Promise<PublishedLostItem[]> {
  if (!getApiBaseUrl()) return [];
  return extractLostItemList(await apiJson<unknown>("/api/lost-items", { method: "GET" }));
}

export async function fetchRemoteLostItems(force = false): Promise<PublishedLostItem[]> {
  if (!force) {
    const cached = getCachedRemoteLostItems();
    if (cached) return cached;
  }
  const items = await fetchRemoteLostItemsFromNetwork();
  setCachedRemoteLostItems(items);
  return items;
}

function extractLostItemList(payload: unknown): PublishedLostItem[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as { content?: unknown[]; data?: unknown[]; items?: unknown[] }).content ??
        (payload as { data?: unknown[] }).data ??
        (payload as { items?: unknown[] }).items ??
        [])
      : [];
  return list
    .map((row) => mapApiLostItem(row as Record<string, unknown>))
    .filter((row): row is PublishedLostItem => row !== null);
}

function parseSortTimestamp(item: PublishedLostItem): number {
  const createdMs = parseDateTimeMs(item.createdAt);
  if (createdMs > 0) return createdMs;
  const idNum = Number(item.id);
  return Number.isNaN(idNum) || idNum <= 0 ? 0 : idNum;
}

/** 홈·관리자 목록: 최신 등록(또는 id) 우선 */
export function sortLostItemsNewestFirst(items: PublishedLostItem[]): PublishedLostItem[] {
  return [...items].sort((a, b) => {
    const diff = parseSortTimestamp(b) - parseSortTimestamp(a);
    if (diff !== 0) return diff;
    return Number(b.id) - Number(a.id);
  });
}
