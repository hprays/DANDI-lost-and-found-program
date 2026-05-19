"use client";

const KEYWORDS_STORAGE_KEY = "dandi.userPrefs.keywords";
const LOCAL_NOTICES_KEY = "dandi.userPrefs.localNotices";

const DEFAULT_KEYWORDS = ["에어팟", "검정", "지갑"];

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
  window.localStorage.setItem(KEYWORDS_STORAGE_KEY, JSON.stringify(keywords));
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
  window.localStorage.setItem(LOCAL_NOTICES_KEY, JSON.stringify(notices.slice(0, 50)));
}
