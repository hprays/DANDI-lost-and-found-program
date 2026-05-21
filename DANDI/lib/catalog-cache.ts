import type { PublishedLostItem } from "@/lib/published-lost-items";

let remoteCache: { items: PublishedLostItem[]; at: number } | null = null;

const REMOTE_CACHE_MS = 45_000;

export function invalidateRemoteLostItemsCache() {
  remoteCache = null;
}

export function getCachedRemoteLostItems(): PublishedLostItem[] | null {
  if (!remoteCache) return null;
  if (Date.now() - remoteCache.at > REMOTE_CACHE_MS) {
    remoteCache = null;
    return null;
  }
  return remoteCache.items;
}

export function setCachedRemoteLostItems(items: PublishedLostItem[]) {
  remoteCache = { items, at: Date.now() };
}
