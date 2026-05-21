import { safeSetLocalStorage } from "@/lib/safe-local-storage";

const KEY = "dandi.itemRegistrationMeta";

type MetaMap = Record<string, string>;

function readMeta(): MetaMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MetaMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function rememberItemRegistrationTime(itemId: string, createdAtIso: string) {
  if (typeof window === "undefined" || !itemId.trim() || !createdAtIso.trim()) return;
  const next = { ...readMeta(), [String(itemId)]: createdAtIso };
  safeSetLocalStorage(KEY, JSON.stringify(next));
}

export function lookupItemRegistrationTime(itemId: string): string | undefined {
  return readMeta()[String(itemId)];
}

export function enrichWithRegistrationMeta(items: { id: string; createdAt?: string }[]) {
  const meta = readMeta();
  return items.map((item) => {
    const stored = meta[String(item.id)];
    if (!stored) return item;
    if (!item.createdAt?.trim()) return { ...item, createdAt: stored };
    return item;
  });
}
