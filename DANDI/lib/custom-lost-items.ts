"use client";

import { catalogIdentityKeys } from "@/lib/catalog-identity";
import { imageForLocalStorage, safeSetLocalStorage } from "@/lib/safe-local-storage";

export type CustomLostItem = {
  id: string;
  name: string;
  category: string;
  type?: string;
  memo?: string;
  place: string;
  time: string;
  storage?: string;
  image?: string;
};

const CUSTOM_LOST_ITEMS_KEY = "dandi.custom.lostItems";
const LOST_ITEM_OVERRIDES_KEY = "dandi.lostItem.overrides";
// v2: 값은 catalogIdentityKeys 형식(id:/lost:/report:)이라 신고 ID와 물품 ID가 섞이지 않는다
const LOST_ITEM_DELETED_IDS_KEY = "dandi.lostItem.deletedIds.v2";

function sanitizeCustomItem(item: CustomLostItem): CustomLostItem {
  return {
    ...item,
    image: imageForLocalStorage(item.image),
  };
}

function persistCustomItems(items: CustomLostItem[]) {
  const slim = items.slice(0, 40).map(sanitizeCustomItem);
  safeSetLocalStorage(CUSTOM_LOST_ITEMS_KEY, JSON.stringify(slim));
}

function persistOverrides(overrides: Record<string, Partial<CustomLostItem>>) {
  const slim: Record<string, Partial<CustomLostItem>> = {};
  for (const [id, patch] of Object.entries(overrides)) {
    slim[id] = {
      ...patch,
      image: imageForLocalStorage(patch.image),
    };
  }
  safeSetLocalStorage(LOST_ITEM_OVERRIDES_KEY, JSON.stringify(slim));
}

export function getCustomLostItems(): CustomLostItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(CUSTOM_LOST_ITEMS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CustomLostItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addCustomLostItem(item: CustomLostItem) {
  if (typeof window === "undefined") return;
  const current = getCustomLostItems();
  persistCustomItems([sanitizeCustomItem(item), ...current]);
}

export function updateCustomLostItem(id: string, patch: Partial<CustomLostItem>) {
  if (typeof window === "undefined") return;
  const current = getCustomLostItems();
  const updated = current.map((item) => (item.id === id ? sanitizeCustomItem({ ...item, ...patch }) : item));
  persistCustomItems(updated);
}

export function deleteCustomLostItem(id: string) {
  if (typeof window === "undefined") return;
  const current = getCustomLostItems();
  const filtered = current.filter((item) => item.id !== id);
  persistCustomItems(filtered);
}

function getLostItemOverridesRaw(): Record<string, Partial<CustomLostItem>> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(LOST_ITEM_OVERRIDES_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<CustomLostItem>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function setLostItemOverride(id: string, patch: Partial<CustomLostItem>) {
  if (typeof window === "undefined") return;
  const current = getLostItemOverridesRaw();
  current[id] = {
    ...(current[id] ?? {}),
    ...patch,
    image: imageForLocalStorage(patch.image) ?? current[id]?.image,
  };
  persistOverrides(current);
}

/** 삭제 후 홈에 사진만 남는 현상 방지 — override에 image만 남아 재적용되는 경우 제거 */
export function clearLostItemOverridesForIds(ids: Array<string | undefined | null>) {
  if (typeof window === "undefined") return;
  const drop = new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean));
  if (drop.size === 0) return;
  const current = getLostItemOverridesRaw();
  let changed = false;
  for (const key of Object.keys(current)) {
    if (drop.has(key)) {
      delete current[key];
      changed = true;
    }
  }
  if (changed) persistOverrides(current);
}

export function getDeletedLostItemIds(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LOST_ITEM_DELETED_IDS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isLostItemMarkedDeleted(item: {
  id: string;
  reportId?: string;
  lostItemId?: string;
}): boolean {
  const deleted = new Set(getDeletedLostItemIds());
  return catalogIdentityKeys(item).some((key) => deleted.has(key));
}

/** 서버 삭제가 끝난 항목을 재조회 전까지 로컬 캐시에서 숨긴다 (물품·연결 신고 키) */
export function markLostItemDeletedForTarget(item: {
  id: string;
  reportId?: string;
  lostItemId?: string;
}) {
  if (typeof window === "undefined") return;
  const current = new Set(getDeletedLostItemIds());
  catalogIdentityKeys(item).forEach((key) => current.add(key));
  safeSetLocalStorage(LOST_ITEM_DELETED_IDS_KEY, JSON.stringify(Array.from(current).slice(-200)));
}

export function applyLostItemAdminChanges<T extends { id: string; reportId?: string }>(
  items: T[]
): Array<T & Partial<CustomLostItem>> {
  const overrides = getLostItemOverridesRaw();
  return items
    .filter((item) => !isLostItemMarkedDeleted(item))
    .map((item) => {
      const override = overrides[item.id];
      return override ? { ...item, ...override } : item;
    });
}
