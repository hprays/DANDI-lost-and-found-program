"use client";

import type { LostReport } from "@/lib/dandi-state";
import { isLostItemMarkedDeleted } from "@/lib/custom-lost-items";
import { resolveCategory } from "@/lib/item-category";
import {
  formatDateTimeLabel,
  pickRicherDateTimeLabel,
  sanitizeLocation,
} from "@/lib/format-display";
import {
  catalogIdentityKeys,
  findCatalogItemByHint,
  isSameCatalogItem,
  lostItemPk,
  normalizeCatalogItemIdentity,
} from "@/lib/catalog-identity";
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
  /** lost_item.status — STORED | ACQUIRED | PENDING_RECEIPT | RECEIVED */
  catalogStatus?: string;
  pickedUpAt?: string;
};

// v2: 신고 ID와 물품 ID를 섞어 저장한 이전 캐시는 버린다
export const PUBLISHED_KEY = "dandi.published.lostItems.v2";
/** localStorage 백업용 — 홈 전체 목록은 API가 기준, 여기는 습득완료 직후 보조만 */
const MAX_STORED_ITEMS = 200;

function sanitizePublishedForStorage(item: PublishedLostItem): PublishedLostItem {
  return {
    ...item,
    image:
      resolveItemImageUrl(item.image) ??
      resolveDisplayImageUrl(item.image) ??
      imageForLocalStorage(item.image),
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
  const minimal = slim.map(
    ({ id, name, category, place, time, reportId, storage, type, image, lostItemId, catalogStatus, pickedUpAt }) => ({
      id,
      name,
      category,
      place,
      time,
      reportId,
      storage,
      type,
      lostItemId,
      catalogStatus,
      pickedUpAt,
      image: resolveItemImageUrl(image) ?? imageForLocalStorage(image),
    })
  );
  safeSetLocalStorage(PUBLISHED_KEY, JSON.stringify(minimal));
}

export { isSameCatalogItem };

/** 같은 물품(lost_item PK 또는 같은 신고에서 나온 카드)을 카드 1장으로 합친다 */
export function dedupePublishedCatalog(items: PublishedLostItem[]): PublishedLostItem[] {
  const groups = new Map<string, PublishedLostItem>();
  const keyToGroup = new Map<string, string>();

  for (const item of items) {
    const keys = catalogIdentityKeys(item);
    const groupKey = keys.map((key) => keyToGroup.get(key)).find(Boolean) ?? keys[0];
    const existing = groups.get(groupKey);
    // 서로 다른 lost_item PK는 합치지 않는다
    if (existing && !isSameCatalogItem(existing, item)) {
      const ownKey = `id:${String(item.id)}`;
      groups.set(ownKey, normalizeCatalogItemIdentity(item));
      continue;
    }
    const merged = existing ? mergePublishedItems(item, existing) : item;
    groups.set(groupKey, normalizeCatalogItemIdentity(merged));
    for (const key of [...keys, ...catalogIdentityKeys(merged)]) keyToGroup.set(key, groupKey);
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
  const items = getPublishedLostItems();
  const target = findCatalogItemByHint(id, items);
  const next = target ? items.filter((it) => !isSameCatalogItem(it, target)) : items;
  setPublishedLostItems(next);
  return next;
}

/** 로컬 published 캐시에서 동일 카드 전부 제거 */
export function removePublishedLostItemByTarget(
  target: PublishedLostItem | { id: string; lostItemId?: string; reportId?: string }
) {
  const next = getPublishedLostItems().filter((it) => !isSameCatalogItem(it, target as PublishedLostItem));
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
  const pk = lostItemPk(primary) ?? lostItemPk(secondary);
  const id = pk ?? String(primary.id);
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
    reportId: primary.reportId ?? secondary.reportId,
    id,
    lostItemId: pk,
    catalogStatus: pickRicherCatalogStatus(primary.catalogStatus, secondary.catalogStatus),
    pickedUpAt: pickRicherDateTimeLabel(primary.pickedUpAt, secondary.pickedUpAt) ?? primary.pickedUpAt ?? secondary.pickedUpAt,
  };
  return merged;
}

function catalogStatusRank(status?: string): number {
  const s = String(status ?? "").trim().toUpperCase();
  if (s === "RECEIVED" || s === "PICKED_UP") return 4;
  if (s === "PENDING_RECEIPT") return 3;
  if (s === "ACQUIRED" || s === "RESOLVED") return 2;
  if (s === "STORED" || s === "PUBLISHED") return 1;
  return 0;
}

export function pickRicherCatalogStatus(a?: string, b?: string): string | undefined {
  const left = a?.trim();
  const right = b?.trim();
  if (!left) return right;
  if (!right) return left;
  return catalogStatusRank(left) >= catalogStatusRank(right) ? left : right;
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
    catalogStatus: "ACQUIRED",
  };
}

export function enrichPublishedItemsWithReports(
  items: PublishedLostItem[],
  reports: Array<{
    id: string;
    image?: string;
    reportId?: string;
    status?: string;
    pickedUpAt?: string;
  }>
): PublishedLostItem[] {
  const byId = new Map(reports.map((r) => [String(r.id), r]));
  return items.map((item) => {
    // 물품 id와 신고 id는 다른 테이블 — reportId로만 연결한다
    const linked = item.reportId ? byId.get(String(item.reportId)) : undefined;
    let next: PublishedLostItem = { ...item };
    const resolvedImage = resolveItemImageUrl(item.image);
    if (resolvedImage && !resolvedImage.startsWith("data:")) {
      next = { ...next, image: resolvedImage };
    } else if (linked?.image) {
      const fromReport = resolveDisplayImageUrl(linked.image) ?? resolveItemImageUrl(linked.image);
      if (fromReport) next = { ...next, image: fromReport };
    }
    if (linked?.status === "resolved") {
      next = { ...next, catalogStatus: pickRicherCatalogStatus(next.catalogStatus, "ACQUIRED") };
    }
    if (linked?.status === "picked_up") {
      next = {
        ...next,
        catalogStatus: pickRicherCatalogStatus(next.catalogStatus, "RECEIVED"),
        pickedUpAt:
          formatDateTimeLabel(linked.pickedUpAt ?? "") || linked.pickedUpAt || next.pickedUpAt,
      };
    }
    return next;
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

  // itemType에는 물품명이 들어오므로 카테고리로 쓰지 않는다
  const category = resolveCategory(readString(raw, "category", "categoryName"), name);
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
    catalogStatus: readString(raw, "status", "itemStatus", "item_status")?.toUpperCase(),
  };
}

/** API에 createdAt이 없을 때 로컬 등록 시각 복원 */
export function finalizeCatalogItems(items: PublishedLostItem[]): PublishedLostItem[] {
  return enrichWithRegistrationMeta(
    dedupePublishedCatalog(items.map(normalizeCatalogItemIdentity))
  ) as PublishedLostItem[];
}
