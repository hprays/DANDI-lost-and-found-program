"use client";

import type { LostReport } from "@/lib/dandi-state";

export type PublishedLostItem = {
  id: string;
  name: string;
  category: string;
  type?: string;
  memo?: string;
  place: string;
  time: string;
  storage?: string;
  image?: string;
  reportId?: string;
};

const PUBLISHED_KEY = "dandi.published.lostItems";

export function getPublishedLostItems(): PublishedLostItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(PUBLISHED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PublishedLostItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setPublishedLostItems(items: PublishedLostItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PUBLISHED_KEY, JSON.stringify(items));
}

export function upsertPublishedLostItem(item: PublishedLostItem) {
  const current = getPublishedLostItems();
  const next = [item, ...current.filter((it) => it.id !== item.id)];
  setPublishedLostItems(next);
  return next;
}

export function removePublishedLostItem(id: string) {
  const next = getPublishedLostItems().filter((it) => it.id !== id);
  setPublishedLostItems(next);
  return next;
}

export function reportToPublishedItem(report: LostReport): PublishedLostItem {
  const lostAtLabel = report.lostAt
    ? new Date(report.lostAt).toLocaleString("ko-KR", { hour12: false })
    : report.createdAt;
  return {
    id: report.id,
    reportId: report.id,
    name: report.itemName,
    category: report.category,
    type: report.itemType,
    memo: report.memo,
    place: report.location,
    time: lostAtLabel,
    storage: report.storage,
    image: report.image,
  };
}

export function mapApiLostItem(raw: Record<string, unknown>): PublishedLostItem | null {
  const id = raw.id ?? raw.lostItemId ?? raw.reportId;
  const name = raw.name ?? raw.itemName;
  if (id == null || name == null) return null;
  const foundAt = raw.foundAt ?? raw.lostAt ?? raw.time ?? raw.createdAt;
  const time =
    typeof foundAt === "string"
      ? Number.isNaN(new Date(foundAt).getTime())
        ? foundAt
        : new Date(foundAt).toLocaleString("ko-KR", { hour12: false })
      : "";
  return {
    id: String(id),
    reportId: raw.reportId != null ? String(raw.reportId) : undefined,
    name: String(name),
    category: String(raw.category ?? "기타"),
    type: raw.type != null ? String(raw.type) : raw.itemType != null ? String(raw.itemType) : undefined,
    memo: raw.memo != null ? String(raw.memo) : raw.description != null ? String(raw.description) : undefined,
    place: String(raw.place ?? raw.location ?? ""),
    time,
    storage: raw.storage != null ? String(raw.storage) : undefined,
    image: raw.image != null ? String(raw.image) : undefined,
  };
}
