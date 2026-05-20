"use client";

import type { LostReport } from "@/lib/dandi-state";
import { formatDateTimeLabel, sanitizeLocation } from "@/lib/format-display";
import { pickImageFromRaw, resolveItemImageUrl } from "@/lib/media-url";
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
  createdAt?: string;
  foundAt?: string;
};

const PUBLISHED_KEY = "dandi.published.lostItems";
/** localStorage 백업용 — 홈 전체 목록은 API가 기준, 여기는 습득완료 직후 보조만 */
const MAX_STORED_ITEMS = 200;

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
  const lostAtLabel = formatDateTimeLabel(report.lostAt) || report.lostAt;
  const createdLabel = formatDateTimeLabel(report.createdAt) || report.createdAt;
  return {
    id: report.id,
    reportId: report.id,
    name: report.itemName,
    category: report.category,
    type: report.itemType,
    memo: report.memo,
    place: sanitizeLocation(report.location),
    time: lostAtLabel || createdLabel,
    foundAt: lostAtLabel,
    storage: report.storage ? sanitizeLocation(report.storage) : undefined,
    image: resolveItemImageUrl(report.image),
    createdAt: createdLabel,
  };
}

export function enrichPublishedItemsWithReports(
  items: PublishedLostItem[],
  reports: Array<{ id: string; image?: string; reportId?: string }>
): PublishedLostItem[] {
  const byId = new Map(reports.map((r) => [String(r.id), r]));
  return items.map((item) => {
    const resolvedImage = resolveItemImageUrl(item.image);
    if (resolvedImage && !resolvedImage.startsWith("data:")) {
      return { ...item, image: resolvedImage };
    }
    const linked =
      (item.reportId ? byId.get(String(item.reportId)) : undefined) ?? byId.get(String(item.id));
    if (linked?.image) {
      const fromReport = resolveItemImageUrl(linked.image);
      if (fromReport) return { ...item, image: fromReport };
    }
    return { ...item, image: resolvedImage?.startsWith("data:") ? resolvedImage : undefined };
  });
}

export function mapApiLostItem(raw: Record<string, unknown>): PublishedLostItem | null {
  const id = raw.id ?? raw.lostItemId ?? raw.reportId;
  const name = raw.name ?? raw.itemName;
  if (id == null || name == null) return null;
  const foundAtRaw = raw.foundAt ?? raw.lostAt ?? raw.acquiredAt ?? raw.time;
  const createdAtRaw = raw.createdAt ?? raw.registeredAt ?? raw.storedDate ?? raw.updatedAt;
  const foundAt =
    typeof foundAtRaw === "string" ? formatDateTimeLabel(foundAtRaw) || foundAtRaw.trim() : "";
  const createdAt =
    typeof createdAtRaw === "string"
      ? formatDateTimeLabel(createdAtRaw) || createdAtRaw.trim()
      : foundAt || undefined;
  const time = foundAt || createdAt || "";
  return {
    id: String(id),
    reportId: raw.reportId != null ? String(raw.reportId) : undefined,
    name: String(name),
    category: String(raw.category ?? "기타"),
    type: raw.type != null ? String(raw.type) : raw.itemType != null ? String(raw.itemType) : undefined,
    memo: raw.memo != null ? String(raw.memo) : raw.description != null ? String(raw.description) : undefined,
    place: sanitizeLocation(String(raw.place ?? raw.location ?? "")),
    time,
    foundAt: foundAt || undefined,
    createdAt,
    storage: raw.storage != null ? String(raw.storage) : undefined,
    image: pickImageFromRaw(raw),
  };
}
