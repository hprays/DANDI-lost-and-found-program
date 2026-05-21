import { formatDateTimeLabel, pickRicherDateTimeLabel } from "@/lib/format-display";
import { resolveDisplayImageUrl, resolveItemImageUrl } from "@/lib/media-url";
import { imageForLocalStorage, safeSetLocalStorage } from "@/lib/safe-local-storage";

const KEY = "dandi.itemRegistrationMeta";

export type ItemTimeMeta = {
  createdAt?: string;
  foundAt?: string;
  imageUrl?: string;
  catalogStatus?: string;
  pickedUpAt?: string;
};

type MetaMap = Record<string, ItemTimeMeta>;

function readMeta(): MetaMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MetaMap;
    if (!parsed || typeof parsed !== "object") return {};
    const next: MetaMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        next[id] = { createdAt: value };
        continue;
      }
      if (value && typeof value === "object") {
        next[id] = {
          createdAt:
            typeof value.createdAt === "string" ? value.createdAt : undefined,
          foundAt: typeof value.foundAt === "string" ? value.foundAt : undefined,
          imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : undefined,
        };
      }
    }
    return next;
  } catch {
    return {};
  }
}

function writeMeta(meta: MetaMap) {
  safeSetLocalStorage(KEY, JSON.stringify(meta));
}

function mergeMetaEntry(existing: ItemTimeMeta | undefined, patch: ItemTimeMeta): ItemTimeMeta {
  return {
    createdAt: patch.createdAt ?? existing?.createdAt,
    foundAt: patch.foundAt ?? existing?.foundAt,
    imageUrl: patch.imageUrl ?? existing?.imageUrl,
    catalogStatus: patch.catalogStatus ?? existing?.catalogStatus,
    pickedUpAt: patch.pickedUpAt ?? existing?.pickedUpAt,
  };
}

export function rememberCatalogStatus(
  itemId: string,
  catalogStatus: string,
  pickedUpAt?: string
) {
  rememberItemTimes(itemId, {
    catalogStatus: catalogStatus.trim().toUpperCase(),
    ...(pickedUpAt ? { pickedUpAt } : {}),
  });
}

export function rememberItemImage(itemId: string, image?: string | null) {
  if (typeof window === "undefined" || !itemId.trim()) return;
  const stored =
    resolveDisplayImageUrl(image) ??
    resolveItemImageUrl(image) ??
    imageForLocalStorage(image);
  if (!stored) return;
  rememberItemTimes(itemId, { imageUrl: stored });
}

export function rememberItemRegistrationTime(itemId: string, createdAtIso: string) {
  rememberItemTimes(itemId, { createdAt: createdAtIso });
}

export function rememberItemTimes(itemId: string, times: ItemTimeMeta) {
  if (typeof window === "undefined" || !itemId.trim()) return;
  const key = String(itemId);
  const meta = readMeta();
  writeMeta({ ...meta, [key]: mergeMetaEntry(meta[key], times) });
}

export function lookupItemTimes(itemId: string): ItemTimeMeta | undefined {
  return readMeta()[String(itemId)];
}

function applyMetaToItem<
  T extends { id: string; reportId?: string; createdAt?: string; foundAt?: string; time?: string; image?: string },
>(item: T): T {
  const byId = lookupItemTimes(item.id);
  const byReport = item.reportId ? lookupItemTimes(item.reportId) : undefined;
  const merged: ItemTimeMeta = { ...byReport, ...byId };

  const createdAt = pickRicherDateTimeLabel(item.createdAt, merged.createdAt);
  const foundAt = pickRicherDateTimeLabel(item.foundAt ?? item.time, merged.foundAt);
  const image =
    resolveDisplayImageUrl(item.image) ??
    resolveItemImageUrl(item.image) ??
    resolveItemImageUrl(merged.imageUrl) ??
    item.image;

  const createdLabel = createdAt ? formatDateTimeLabel(createdAt) || createdAt : undefined;
  const foundLabel = foundAt ? formatDateTimeLabel(foundAt) || foundAt : undefined;

  const itemExt = item as T & { catalogStatus?: string; pickedUpAt?: string };
  const pickedUpLabel = merged.pickedUpAt
    ? formatDateTimeLabel(merged.pickedUpAt) || merged.pickedUpAt
    : itemExt.pickedUpAt
      ? formatDateTimeLabel(itemExt.pickedUpAt) || itemExt.pickedUpAt
      : undefined;

  return {
    ...item,
    createdAt: createdLabel ?? item.createdAt,
    foundAt: foundLabel ?? item.foundAt,
    time: createdLabel ?? foundLabel ?? item.time,
    image,
    catalogStatus: itemExt.catalogStatus ?? merged.catalogStatus,
    pickedUpAt: pickedUpLabel,
  } as T;
}

/** API·새로고침 후에도 등록·습득 시각·사진 URL 유지 */
export function enrichWithRegistrationMeta<
  T extends { id: string; reportId?: string; createdAt?: string; foundAt?: string; time?: string; image?: string },
>(items: T[]): T[] {
  return items.map(applyMetaToItem);
}
