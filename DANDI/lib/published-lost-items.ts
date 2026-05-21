"use client";

import type { LostReport } from "@/lib/dandi-state";
import { isLostItemMarkedDeleted } from "@/lib/custom-lost-items";
import {
  formatDateTimeLabel,
  pickRicherDateTimeLabel,
  sanitizeLocation,
} from "@/lib/format-display";
import {
  canonicalLostItemId,
  normalizeCatalogItemIdentity,
} from "@/lib/catalog-identity";

function isLostItemPkRow(item: PublishedLostItem): boolean {
  const id = String(item.id);
  const reportId = item.reportId ? String(item.reportId) : "";
  return /^\d+$/.test(id) && (!reportId || reportId !== id);
}
import { enrichWithRegistrationMeta } from "@/lib/registration-meta";
import { pickImageFromRaw, resolveDisplayImageUrl, resolveItemImageUrl } from "@/lib/media-url";
import { imageForLocalStorage, safeRemoveLocalStorage, safeSetLocalStorage } from "@/lib/safe-local-storage";

export type PublishedLostItem = {
  id: string;
  /** API PATCH/DELETE용 lost_item PK */
  lostItemId?: string;
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

/** 같은 신고·분실물을 id/reportId 조합으로 판별 */
export function isSameCatalogItem(a: PublishedLostItem, b: PublishedLostItem): boolean {
  if (String(a.id) === String(b.id)) return true;
  const aReport = a.reportId ? String(a.reportId) : null;
  const bReport = b.reportId ? String(b.reportId) : null;
  if (aReport && (aReport === String(b.id) || aReport === bReport)) return true;
  if (bReport && (bReport === String(a.id) || bReport === aReport)) return true;
  return false;
}

/** reportId·lostItemId가 달라도 홈에 카드 1장만 */
export function dedupePublishedCatalog(items: PublishedLostItem[]): PublishedLostItem[] {
  const groups = new Map<string, PublishedLostItem>();
  const aliasToGroup = new Map<string, string>();

  const linkAliases = (groupKey: string, item: PublishedLostItem) => {
    aliasToGroup.set(`id:${item.id}`, groupKey);
    if (item.reportId) {
      aliasToGroup.set(`id:${item.reportId}`, groupKey);
      aliasToGroup.set(`report:${item.reportId}`, groupKey);
    }
  };

  const findGroupKey = (item: PublishedLostItem): string | null => {
    const probes = [
      `id:${item.id}`,
      item.reportId ? `id:${item.reportId}` : "",
      item.reportId ? `report:${item.reportId}` : "",
    ].filter(Boolean);
    for (const probe of probes) {
      const group = aliasToGroup.get(probe);
      if (group) return group;
    }
    return null;
  };

  for (const item of items) {
    const existingGroup = findGroupKey(item);
    const groupKey = existingGroup ?? (item.reportId ? `report:${item.reportId}` : `item:${item.id}`);
    const existing = groups.get(groupKey);
    const merged = existing ? mergePublishedItems(item, existing) : item;
    groups.set(groupKey, normalizeCatalogItemIdentity(merged));
    linkAliases(groupKey, item);
    linkAliases(groupKey, merged);
  }

  return Array.from(groups.values()).filter(
    (item) => isLostItemMarkedDeleted(item) === false && Boolean(item.name?.trim())
  );
}

export function upsertPublishedLostItem(item: PublishedLostItem) {
  const current = getPublishedLostItems();
  const filtered = current.filter((it) => !isSameCatalogItem(it, item));
  const next = dedupePublishedCatalog([item, ...filtered]);
  setPublishedLostItems(next);
  return next;
}

export function removePublishedLostItem(id: string) {
  const targetId = String(id);
  const next = getPublishedLostItems().filter(
    (it) => String(it.id) !== targetId && String(it.reportId ?? "") !== targetId
  );
  setPublishedLostItems(next);
  return next;
}

/** 원격·로컬·검수 병합 시 사진·메타 누락 방지 */
export function mergePublishedItems(
  primary: PublishedLostItem,
  secondary?: PublishedLostItem | null
): PublishedLostItem {
  if (!secondary) return primary;
  const image =
    resolveItemImageUrl(primary.image) ??
    resolveItemImageUrl(secondary.image) ??
    primary.image ??
    secondary.image;
  const foundAt = pickRicherDateTimeLabel(primary.foundAt ?? primary.time, secondary.foundAt ?? secondary.time);
  const createdAt = pickRicherDateTimeLabel(primary.createdAt, secondary.createdAt);
  const apiRow = [primary, secondary].find(isLostItemPkRow) ?? secondary ?? primary;
  const id = canonicalLostItemId(primary, secondary);
  const lostItemId = /^\d+$/.test(id) ? id : apiRow.lostItemId;
  const merged: PublishedLostItem = {
    ...secondary,
    ...primary,
    image,
    name: primary.name || secondary.name,
    category: primary.category || secondary.category,
    place: primary.place || secondary.place,
    storage: primary.storage ?? secondary.storage,
    memo: primary.memo ?? secondary.memo,
    type: primary.type ?? secondary.type,
    foundAt,
    createdAt,
    time: createdAt || foundAt || primary.time || secondary.time,
    reportId: primary.reportId ?? secondary.reportId ?? apiRow.reportId,
    id,
    lostItemId: lostItemId ?? (/^\d+$/.test(id) ? id : undefined),
  };
  return merged;
}

/** 검수 완료 직후·API 미동기화 시에만 사용 — id는 lost_item PK가 확정되면 교체 */
export function reportToPublishedItem(report: LostReport, lostItemId?: string): PublishedLostItem {
  const lostAtLabel = formatDateTimeLabel(report.lostAt) || report.lostAt;
  const createdLabel = formatDateTimeLabel(report.createdAt) || report.createdAt;
  const catalogId = lostItemId?.trim() ? String(lostItemId) : `report-${report.id}`;
  return {
    id: catalogId,
    reportId: report.id,
    name: report.itemName,
    category: report.category,
    type: report.itemType,
    memo: report.memo,
    place: sanitizeLocation(report.location),
    time: lostAtLabel || createdLabel,
    foundAt: lostAtLabel,
    storage: report.storage ? sanitizeLocation(report.storage) : undefined,
    image: resolveDisplayImageUrl(report.image) ?? resolveItemImageUrl(report.image),
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
      const fromReport = resolveDisplayImageUrl(linked.image) ?? resolveItemImageUrl(linked.image);
      if (fromReport) return { ...item, image: fromReport };
    }
    return { ...item, image: resolvedImage?.startsWith("data:") ? resolvedImage : undefined };
  });
}

function readString(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/** DANDI_Backend LostItemResponse / lost_item 컬럼 매핑 */
export function mapApiLostItem(raw: Record<string, unknown>): PublishedLostItem | null {
  const id = raw.id ?? raw.lostItemId;
  const name = readString(raw, "itemName", "name", "item_name");
  if (id == null || !name) return null;

  const category =
    readString(raw, "category", "itemType", "item_type") ?? "기타";
  const type = readString(raw, "type", "itemType", "item_type");
  const memo = readString(raw, "memo", "contact", "description");
  const place = sanitizeLocation(
    readString(raw, "place", "location", "foundLocation", "found_location", "lostLocation", "lost_location") ?? ""
  );
  const storage = readString(raw, "storage", "storedLocation", "stored_location");

  const foundAtRaw = readString(
    raw,
    "foundAt",
    "lostAt",
    "storedDate",
    "stored_date",
    "acquiredAt",
    "time"
  );
  const createdAtRaw = readString(
    raw,
    "createdAt",
    "created_at",
    "registeredAt",
    "registered_at"
  );
  const reportIdRaw = raw.reportId ?? raw.report_id;

  const foundAt = foundAtRaw ? formatDateTimeLabel(foundAtRaw) || foundAtRaw : "";
  const createdAt = createdAtRaw
    ? formatDateTimeLabel(createdAtRaw) || createdAtRaw
    : foundAt
      ? foundAt
      : undefined;
  const time = createdAt || foundAt || "";

  const lostItemId = String(id);
  return {
    id: lostItemId,
    lostItemId,
    reportId: reportIdRaw != null ? String(reportIdRaw) : undefined,
    name,
    category,
    type: type && type !== category ? type : undefined,
    memo,
    place,
    time,
    foundAt: foundAt || undefined,
    createdAt,
    storage,
    image: pickImageFromRaw(raw),
  };
}

/** API에 createdAt이 없을 때 로컬 등록 시각 복원 */
export function finalizeCatalogItems(items: PublishedLostItem[]): PublishedLostItem[] {
  return enrichWithRegistrationMeta(
    dedupePublishedCatalog(items.map(normalizeCatalogItemIdentity))
  ) as PublishedLostItem[];
}
