"use client";

import { useEffect, useRef } from "react";
import { BuildingLocationPicker } from "@/components/building-location-picker";
import { useBuildingLocationField } from "@/lib/building-location";

type ManageLocationPickersProps = {
  idPrefix: string;
  place: string;
  storage: string;
  onPlaceChange: (value: string) => void;
  onStorageChange: (value: string) => void;
};

/** 물품 관리 — 습득·보관 위치를 등록 폼과 동일한 건물 선택(스크롤) UI로 편집 */
export function ManageLocationPickers({
  idPrefix,
  place,
  storage,
  onPlaceChange,
  onStorageChange,
}: ManageLocationPickersProps) {
  const found = useBuildingLocationField(place);
  const storageLoc = useBuildingLocationField(storage);
  const syncingPlaceRef = useRef(false);
  const syncingStorageRef = useRef(false);

  useEffect(() => {
    if (syncingPlaceRef.current) return;
    if (place !== found.composed) {
      found.applyFromLocation(place);
    }
  }, [place, found.composed, found.applyFromLocation]);

  useEffect(() => {
    if (found.composed === place) return;
    syncingPlaceRef.current = true;
    onPlaceChange(found.composed);
    syncingPlaceRef.current = false;
  }, [found.composed, onPlaceChange, place]);

  useEffect(() => {
    if (syncingStorageRef.current) return;
    if (storage !== storageLoc.composed) {
      storageLoc.applyFromLocation(storage);
    }
  }, [storage, storageLoc.composed, storageLoc.applyFromLocation]);

  useEffect(() => {
    if (storageLoc.composed === storage) return;
    syncingStorageRef.current = true;
    onStorageChange(storageLoc.composed);
    syncingStorageRef.current = false;
  }, [storageLoc.composed, onStorageChange, storage]);

  return (
    <>
      <BuildingLocationPicker
        idPrefix={`${idPrefix}-found`}
        label="습득 위치"
        building={found.building}
        detail={found.detail}
        customText={found.customText}
        onBuildingChange={found.setBuilding}
        onDetailChange={found.setDetail}
        onCustomTextChange={found.setCustomText}
        detailPlaceholder="예: 1층 북카페, 307호"
      />
      <BuildingLocationPicker
        idPrefix={`${idPrefix}-storage`}
        label="보관 장소"
        building={storageLoc.building}
        detail={storageLoc.detail}
        customText={storageLoc.customText}
        onBuildingChange={storageLoc.setBuilding}
        onDetailChange={storageLoc.setDetail}
        onCustomTextChange={storageLoc.setCustomText}
        detailPlaceholder="예: 학생팀 425호, 분실물 보관함"
      />
    </>
  );
}
