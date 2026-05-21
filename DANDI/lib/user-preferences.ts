"use client";

import { safeSetLocalStorage } from "@/lib/safe-local-storage";

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

export function setStoredKeywords(keywords: string[]) {
  if (typeof window === "undefined") return;
  if (safeSetLocalStorage(KEYWORDS_STORAGE_KEY, JSON.stringify(keywords))) {
    window.dispatchEvent(new CustomEvent(KEYWORDS_CHANGED_EVENT, { detail: keywords }));
  }
}

export function getStoredAlertEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(ALERT_ENABLED_KEY);
  if (raw === "false") return false;
  return true;
}

export function setStoredAlertEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  safeSetLocalStorage(ALERT_ENABLED_KEY, enabled ? "true" : "false");
}

export type StoredNotice = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export function getStoredLocalNotices(): StoredNotice[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LOCAL_NOTICES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredNotice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setStoredLocalNotices(notices: StoredNotice[]) {
  if (typeof window === "undefined") return;
  safeSetLocalStorage(LOCAL_NOTICES_KEY, JSON.stringify(notices.slice(0, 50)));
}
