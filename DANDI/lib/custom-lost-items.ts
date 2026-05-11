"use client";

export type CustomLostItem = {
  id: string;
  name: string;
  category: string;
  type?: string;
  memo?: string;
  place: string;
  time: string;
  image?: string;
};

const CUSTOM_LOST_ITEMS_KEY = "dandi.custom.lostItems";
const LOST_ITEM_OVERRIDES_KEY = "dandi.lostItem.overrides";
const LOST_ITEM_DELETED_IDS_KEY = "dandi.lostItem.deletedIds";

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
  window.localStorage.setItem(CUSTOM_LOST_ITEMS_KEY, JSON.stringify([item, ...current]));
}

export function updateCustomLostItem(id: string, patch: Partial<CustomLostItem>) {
  if (typeof window === "undefined") return;
  const current = getCustomLostItems();
  const updated = current.map((item) => (item.id === id ? { ...item, ...patch } : item));
  window.localStorage.setItem(CUSTOM_LOST_ITEMS_KEY, JSON.stringify(updated));
}

export function deleteCustomLostItem(id: string) {
  if (typeof window === "undefined") return;
  const current = getCustomLostItems();
  const filtered = current.filter((item) => item.id !== id);
  window.localStorage.setItem(CUSTOM_LOST_ITEMS_KEY, JSON.stringify(filtered));
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
  };
  window.localStorage.setItem(LOST_ITEM_OVERRIDES_KEY, JSON.stringify(current));
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

export function markLostItemDeleted(id: string) {
  if (typeof window === "undefined") return;
  const current = new Set(getDeletedLostItemIds());
  current.add(id);
  window.localStorage.setItem(LOST_ITEM_DELETED_IDS_KEY, JSON.stringify(Array.from(current)));
}

export function applyLostItemAdminChanges<T extends { id: string }>(items: T[]): Array<T & Partial<CustomLostItem>> {
  const deleted = new Set(getDeletedLostItemIds());
  const overrides = getLostItemOverridesRaw();
  return items
    .filter((item) => !deleted.has(item.id))
    .map((item) => {
      const override = overrides[item.id];
      return override ? { ...item, ...override } : item;
    });
}
