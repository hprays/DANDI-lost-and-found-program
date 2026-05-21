import { formatDateTimeLabel, pickRicherDateTimeLabel } from "@/lib/format-display";
import { safeSetLocalStorage } from "@/lib/safe-local-storage";

const KEY = "dandi.itemRegistrationMeta";

export type ItemTimeMeta = {
  createdAt?: string;
  foundAt?: string;
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
  };
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

function applyMetaToItem<T extends { id: string; reportId?: string; createdAt?: string; foundAt?: string; time?: string }>(
  item: T
): T {
  const byId = lookupItemTimes(item.id);
  const byReport = item.reportId ? lookupItemTimes(item.reportId) : undefined;
  const merged: ItemTimeMeta = { ...byReport, ...byId };

  const createdAt = pickRicherDateTimeLabel(item.createdAt, merged.createdAt);
  const foundAt = pickRicherDateTimeLabel(item.foundAt ?? item.time, merged.foundAt);

  const createdLabel = createdAt ? formatDateTimeLabel(createdAt) || createdAt : undefined;
  const foundLabel = foundAt ? formatDateTimeLabel(foundAt) || foundAt : undefined;

  return {
    ...item,
    createdAt: createdLabel ?? item.createdAt,
    foundAt: foundLabel ?? item.foundAt,
    time: createdLabel ?? foundLabel ?? item.time,
  };
}

/** API·새로고침 후에도 등록·습득 시각 유지 */
export function enrichWithRegistrationMeta<T extends { id: string; reportId?: string; createdAt?: string; foundAt?: string; time?: string }>(
  items: T[]
): T[] {
  return items.map(applyMetaToItem);
}
