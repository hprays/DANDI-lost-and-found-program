"use client";

import { safeRemoveLocalStorage, safeSetLocalStorage } from "@/lib/safe-local-storage";

const KEYWORDS_STORAGE_KEY = "dandi.userPrefs.keywords";
const ALERT_ENABLED_KEY = "dandi.userPrefs.alertEnabled";
const LOCAL_NOTICES_KEY = "dandi.userPrefs.localNotices";

const DEFAULT_KEYWORDS: string[] = [];

export const KEYWORDS_CHANGED_EVENT = "dandi-keywords-changed";

export function getStoredKeywords(): string[] {
  if (typeof window === "undefined") return DEFAULT_KEYWORDS;
  const raw = window.localStorage.getItem(KEYWORDS_STORAGE_KEY);
  if (!raw) return DEFAULT_KEYWORDS;
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : DEFAULT_KEYWORDS;
  } catch {
    return DEFAULT_KEYWORDS;
  }
}

export function setStoredKeywords(keywords: string[], options?: { silent?: boolean }) {
  if (typeof window === "undefined") return;
  if (safeSetLocalStorage(KEYWORDS_STORAGE_KEY, JSON.stringify(keywords))) {
    if (!options?.silent) {
      window.dispatchEvent(new CustomEvent(KEYWORDS_CHANGED_EVENT, { detail: keywords }));
    }
  }
}

/** 예전에 브라우저에만 저장하던 알림·알림 받기 설정을 지운다. 둘 다 이제 서버 DB가 기준이다. */
export function clearLegacyLocalState() {
  safeRemoveLocalStorage(LOCAL_NOTICES_KEY);
  safeRemoveLocalStorage(ALERT_ENABLED_KEY);
}
