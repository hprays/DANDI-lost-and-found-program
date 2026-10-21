"use client";

import { useCallback, useMemo, useState } from "react";
import { officeForBuilding, officeStorageLabel } from "@/lib/item-filters";
import { officeMarkers, selectableBuildings } from "@/lib/mock-data";

export const BUILDING_CUSTOM = "__custom__";

export type BuildingLocationValue = {
  building: string;
  detail: string;
  customText: string;
};

export function composeBuildingLocation({ building, detail, customText }: BuildingLocationValue): string {
  if (building === BUILDING_CUSTOM) return customText.trim();
  if (!building) return "";
  return [building, detail.trim()].filter(Boolean).join(" ");
}

export function parseBuildingLocation(location: string): BuildingLocationValue {
  const trimmed = location.trim();
  if (!trimmed) {
    return { building: "", detail: "", customText: "" };
  }

  const matched = [...selectableBuildings]
    .sort((a, b) => b.length - a.length)
    .find((name) => trimmed === name || trimmed.startsWith(`${name} `));

  if (matched) {
    return {
      building: matched,
      detail: trimmed.slice(matched.length).trim(),
      customText: "",
    };
  }

  return { building: BUILDING_CUSTOM, detail: "", customText: trimmed };
}

const DEFAULT_STORAGE_OFFICE = "혜당관 학생팀";

/** 습득 위치 건물의 관리실을 보관 장소로 — 관리실이 없는 건물·직접 작성한 위치는 기본 보관실 */
export function storageForLocation(location: string): string {
  const { building } = parseBuildingLocation(location);
  const office =
    officeForBuilding(building === BUILDING_CUSTOM ? "" : building, officeMarkers) ??
    officeMarkers.find((o) => o.name === DEFAULT_STORAGE_OFFICE)!;
  return officeStorageLabel(office);
}

export function isBuildingLocationValid({ building, customText }: BuildingLocationValue): boolean {
  if (!building) return false;
  if (building === BUILDING_CUSTOM) return customText.trim().length > 0;
  return true;
}

export function useBuildingLocationField(initialLocation = "") {
  const parsed = useMemo(() => parseBuildingLocation(initialLocation), [initialLocation]);
  const [building, setBuilding] = useState(parsed.building);
  const [detail, setDetail] = useState(parsed.detail);
  const [customText, setCustomText] = useState(parsed.customText);

  const composed = useMemo(
    () => composeBuildingLocation({ building, detail, customText }),
    [building, detail, customText]
  );

  const reset = useCallback(() => {
    setBuilding("");
    setDetail("");
    setCustomText("");
  }, []);

  const applyFromLocation = useCallback((location: string) => {
    const parsed = parseBuildingLocation(location);
    setBuilding(parsed.building);
    setDetail(parsed.detail);
    setCustomText(parsed.customText);
  }, []);

  return {
    building,
    setBuilding,
    detail,
    setDetail,
    customText,
    setCustomText,
    composed,
    isValid: isBuildingLocationValid({ building, detail, customText }),
    reset,
    applyFromLocation,
    isCustom: building === BUILDING_CUSTOM,
  };
}
