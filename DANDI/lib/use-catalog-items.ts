"use client";

import { useEffect, useMemo } from "react";
import { applyLostItemAdminChanges } from "@/lib/custom-lost-items";
import { useDandiState } from "@/lib/dandi-state";
import { lostItems } from "@/lib/mock-data";
import type { PublishedLostItem } from "@/lib/published-lost-items";

// mock 항목도 실제 카탈로그 타입으로 다룬다
const MOCK_CATALOG_ITEMS: PublishedLostItem[] = lostItems;
const USE_MOCK_LOST_ITEMS = process.env.NEXT_PUBLIC_ENABLE_MOCK_LOST_ITEMS === "true";

/** 홈·관심 화면 공용 공개 물품 목록 (관리자 변경·mock 반영) */
export function useCatalogItems() {
  const { homeLostItems, catalogLoading, catalogLoaded, catalogError, refreshHomeCatalog } = useDandiState();

  // 목록 길이가 아니라 최초 조회 여부로 판단 — 정상 빈 목록에서 재조회가 반복되지 않는다
  useEffect(() => {
    if (!catalogLoaded && !catalogLoading) {
      void refreshHomeCatalog();
    }
  }, [catalogLoaded, catalogLoading, refreshHomeCatalog]);

  const items = useMemo(() => {
    const published = applyLostItemAdminChanges(homeLostItems);
    if (!USE_MOCK_LOST_ITEMS) return published;
    return applyLostItemAdminChanges([...published, ...MOCK_CATALOG_ITEMS]);
  }, [homeLostItems]);

  return { items, catalogLoading, catalogError, refreshHomeCatalog };
}

/** 물품 검색용 텍스트 (이름·카테고리·종류·장소·메모) */
export function itemSearchText(item: PublishedLostItem): string {
  return [item.name, item.category, item.type, item.place, item.storage, item.memo]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
