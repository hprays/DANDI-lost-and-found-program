"use client";

import type { LostReport } from "@/lib/dandi-state";
import { formatDateTimeLabel, sanitizeLocation } from "@/lib/format-display";
import { pickImageFromRaw, resolveMediaUrl } from "@/lib/media-url";
import { imageForLocalStorage, safeRemoveLocalStorage, safeSetLocalStorage } from "@/lib/safe-local-storage";

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
const MAX_STORED_ITEMS = 40;

function sanitizePublishedForStorage(item: PublishedLostItem): PublishedLostItem {
  return {
    ...item,
    image: imageForLocalStorage(item.image),
    memo: item.memo && item.memo.length > 500 ? `${item.memo.slice(0, 500)}…` : item.memo,
  };
}

export function getPublishedLostItems(): PublishedLostItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(PUBLISHED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PublishedLostItem[];
    return Array.isArray(parsed) ? parsed.map(sanitizePublishedForStorage) : [];
  } catch {
    safeRemoveLocalStorage(PUBLISHED_KEY);
    return [];
  }
}

export function setPublishedLostItems(items: PublishedLostItem[]) {
  if (typeof window === "undefined") return;

  const slim = items.slice(0, MAX_STORED_ITEMS).map(sanitizePublishedForStorage);
  const payload = JSON.stringify(slim);

  if (safeSetLocalStorage(PUBLISHED_KEY, payload)) return;

  // 용량 초과 시 키를 비우고 메타데이터만 다시 저장 (UI 크래시 방지)
  safeRemoveLocalStorage(PUBLISHED_KEY);
  const minimal = slim.map(({ id, name, category, place, time, reportId, storage, type }) => ({
    id,
    name,
    category,
    place,
    time,
    reportId,
    storage,
    type,
  }));
  safeSetLocalStorage(PUBLISHED_KEY, JSON.stringify(minimal));
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
  const lostAtLabel = formatDateTimeLabel(report.lostAt) || report.createdAt;
  return {
    id: report.id,
    reportId: report.id,
    name: report.itemName,
    category: report.category,
    type: report.itemType,
    memo: report.memo,
    place: sanitizeLocation(report.location),
    time: lostAtLabel,
    storage: report.storage ? sanitizeLocation(report.storage) : undefined,
    image: resolveMediaUrl(report.image),
  };
}

export function enrichPublishedItemsWithReports(
  items: PublishedLostItem[],
  reports: Array<{ id: string; image?: string; reportId?: string }>
): PublishedLostItem[] {
  const byId = new Map(reports.map((r) => [String(r.id), r]));
  return items.map((item) => {
    const resolvedImage = resolveMediaUrl(item.image);
    if (resolvedImage && !resolvedImage.startsWith("data:")) {
      return { ...item, image: resolvedImage };
    }
    const linked =
      (item.reportId ? byId.get(String(item.reportId)) : undefined) ?? byId.get(String(item.id));
    if (linked?.image) {
      const fromReport = resolveMediaUrl(linked.image);
      if (fromReport) return { ...item, image: fromReport };
    }
    return { ...item, image: resolvedImage?.startsWith("data:") ? resolvedImage : item.image };
  });
}

export function mapApiLostItem(raw: Record<string, unknown>): PublishedLostItem | null {
  const id = raw.id ?? raw.lostItemId ?? raw.reportId;
  const name = raw.name ?? raw.itemName;
  if (id == null || name == null) return null;
  const foundAt = raw.foundAt ?? raw.lostAt ?? raw.time ?? raw.createdAt;
  const time = typeof foundAt === "string" ? formatDateTimeLabel(foundAt) : "";
  return {
    id: String(id),
    reportId: raw.reportId != null ? String(raw.reportId) : undefined,
    name: String(name),
    category: String(raw.category ?? "기타"),
    type: raw.type != null ? String(raw.type) : raw.itemType != null ? String(raw.itemType) : undefined,
    memo: raw.memo != null ? String(raw.memo) : raw.description != null ? String(raw.description) : undefined,
    place: sanitizeLocation(String(raw.place ?? raw.location ?? "")),
    time,
    storage: raw.storage != null ? String(raw.storage) : undefined,
    image: pickImageFromRaw(raw),
  };
}
