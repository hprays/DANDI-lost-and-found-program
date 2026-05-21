"use client";

import { useEffect, useState } from "react";
import { BuildingLocationPicker } from "@/components/building-location-picker";
import {
  BUILDING_CUSTOM,
  composeBuildingLocation,
  parseBuildingLocation,
  type BuildingLocationValue,
} from "@/lib/building-location";

type ManageLocationPickersProps = {
  idPrefix: string;
  place: string;
  storage: string;
  onPlaceChange: (value: string) => void;
  onStorageChange: (value: string) => void;
};

/** 물품 관리 — 위치 변경 시에만 부모 draft 갱신 (effect 루프 없음) */
export function ManageLocationPickers({
  idPrefix,
  place,
  storage,
  onPlaceChange,
  onStorageChange,
}: ManageLocationPickersProps) {
  const [found, setFound] = useState<BuildingLocationValue>(() => parseBuildingLocation(place));
  const [stor, setStor] = useState<BuildingLocationValue>(() => parseBuildingLocation(storage));

  useEffect(() => {
    setFound(parseBuildingLocation(place));
  }, [place]);

  useEffect(() => {
    setStor(parseBuildingLocation(storage));
  }, [storage]);

  const updateFound = (next: BuildingLocationValue) => {
    setFound(next);
    onPlaceChange(composeBuildingLocation(next));
  };

  const updateStor = (next: BuildingLocationValue) => {
    setStor(next);
    onStorageChange(composeBuildingLocation(next));
  };

  return (
    <>
      <BuildingLocationPicker
        idPrefix={`${idPrefix}-found`}
        label="습득 위치"
        building={found.building}
        detail={found.detail}
        customText={found.customText}
        onBuildingChange={(building) => {
          updateFound({
            building,
            detail: building === BUILDING_CUSTOM ? "" : found.detail,
            customText: building === BUILDING_CUSTOM ? found.customText : "",
          });
        }}
        onDetailChange={(detail) => updateFound({ ...found, detail })}
        onCustomTextChange={(customText) => updateFound({ ...found, customText })}
        detailPlaceholder="예: 1층 북카페, 307호"
      />
      <BuildingLocationPicker
        idPrefix={`${idPrefix}-storage`}
        label="보관 장소"
        building={stor.building}
        detail={stor.detail}
        customText={stor.customText}
        onBuildingChange={(building) => {
          updateStor({
            building,
            detail: building === BUILDING_CUSTOM ? "" : stor.detail,
            customText: building === BUILDING_CUSTOM ? stor.customText : "",
          });
        }}
        onDetailChange={(detail) => updateStor({ ...stor, detail })}
        onCustomTextChange={(customText) => updateStor({ ...stor, customText })}
        detailPlaceholder="예: 학생팀 425호, 분실물 보관함"
      />
    </>
  );
}
