"use client";

export type CustomLostItem = {
  id: string;
  name: string;
  category: string;
  type?: string;
  place: string;
  time: string;
  image?: string;
};

const CUSTOM_LOST_ITEMS_KEY = "dandi.custom.lostItems";

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
