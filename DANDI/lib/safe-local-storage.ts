"use client";

/** 브라우저 localStorage(보통 5MB) 초과 시 앱이 크래시하지 않도록 안전하게 저장합니다. */

export function isDataUrl(value: string | undefined | null): boolean {
  return Boolean(value?.trim().toLowerCase().startsWith("data:"));
}

/** localStorage에는 HTTP(S) URL·짧은 상대 경로만 보관합니다. base64는 제외합니다. */
export function imageForLocalStorage(value: string | undefined | null): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  if (isDataUrl(trimmed)) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    if (trimmed.length > 2048) return undefined;
    return trimmed;
  }
  return undefined;
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014;
}

export function safeSetLocalStorage(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error;
    return false;
  }
}

export function safeRemoveLocalStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const DANDI_STORAGE_KEYS = [
  "dandi.published.lostItems",
  "dandi.custom.lostItems",
  "dandi.lostItem.overrides",
  "dandi.lostItem.deletedIds",
  "dandi.userPrefs.localNotices",
] as const;

/** data URL·과대 항목을 정리해 UI 복구에 사용합니다. */
export function compactDandiLocalStorage(): { clearedKeys: string[] } {
  if (typeof window === "undefined") return { clearedKeys: [] };
  const clearedKeys: string[] = [];

  for (const key of DANDI_STORAGE_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;

    if (raw.length > 800_000 || raw.includes("data:image")) {
      safeRemoveLocalStorage(key);
      clearedKeys.push(key);
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const sanitized = sanitizeStoragePayload(parsed);
      const next = JSON.stringify(sanitized);
      if (next.length > 800_000) {
        safeRemoveLocalStorage(key);
        clearedKeys.push(key);
        continue;
      }
      if (!safeSetLocalStorage(key, next)) {
        safeRemoveLocalStorage(key);
        clearedKeys.push(key);
      }
    } catch {
      safeRemoveLocalStorage(key);
      clearedKeys.push(key);
    }
  }

  return { clearedKeys };
}

function sanitizeStoragePayload(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return isDataUrl(value) ? undefined : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 60).map((item) => sanitizeStoragePayload(item));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "image" || k === "itemImage" || k === "photo") {
        const stored = typeof v === "string" ? imageForLocalStorage(v) : undefined;
        if (stored) next[k] = stored;
        continue;
      }
      next[k] = sanitizeStoragePayload(v);
    }
    return next;
  }
  return value;
}
