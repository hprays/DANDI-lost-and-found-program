import type { PublishedLostItem } from "@/lib/published-lost-items";
import { mapApiLostItem } from "@/lib/published-lost-items";
import { apiJson } from "@/lib/api-json";
import { getApiBaseUrl } from "@/lib/api-json";

export async function fetchRemoteLostItems(): Promise<PublishedLostItem[]> {
  const base = getApiBaseUrl();
  if (!base) return [];
  try {
    return extractLostItemList(await apiJson<unknown>("/api/lost-items", { method: "GET" }));
  } catch {
    try {
      return extractLostItemList(await apiJson<unknown>("/lost-items", { method: "GET" }));
    } catch {
      return [];
    }
  }
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
  const candidates = [item.createdAt, item.time].filter(Boolean) as string[];
  for (const raw of candidates) {
    const isoLike = raw.includes("T") ? raw : raw.replace(/\./g, "/").replace(/\s*시/g, ":").replace(/분/g, ":").replace(/초/g, "");
    const parsed = Date.parse(isoLike);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const idNum = Number(item.id);
  return Number.isNaN(idNum) ? 0 : idNum;
}

/** 홈·관리자 목록: 최신 등록(또는 id) 우선 */
export function sortLostItemsNewestFirst(items: PublishedLostItem[]): PublishedLostItem[] {
  return [...items].sort((a, b) => {
    const diff = parseSortTimestamp(b) - parseSortTimestamp(a);
    if (diff !== 0) return diff;
    return Number(b.id) - Number(a.id);
  });
}
