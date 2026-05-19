"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUILDING_CUSTOM } from "@/lib/building-location";
import { selectableBuildings } from "@/lib/mock-data";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type BuildingLocationPickerProps = {
  idPrefix: string;
  label: string;
  building: string;
  detail: string;
  customText: string;
  onBuildingChange: (value: string) => void;
  onDetailChange: (value: string) => void;
  onCustomTextChange: (value: string) => void;
  detailPlaceholder?: string;
  customPlaceholder?: string;
};

export function BuildingLocationPicker({
  idPrefix,
  label,
  building,
  detail,
  customText,
  onBuildingChange,
  onDetailChange,
  onCustomTextChange,
  detailPlaceholder = "예: 1층 북카페, 307호",
  customPlaceholder = "예: 캠퍼스 밖 편의점 앞",
}: BuildingLocationPickerProps) {
  const isCustom = building === BUILDING_CUSTOM;

  const onBuildingSelect = (next: string) => {
    onBuildingChange(next);
    if (next === BUILDING_CUSTOM) {
      onDetailChange("");
    } else {
      onCustomTextChange("");
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-building`}>{label}</Label>
      <select
        id={`${idPrefix}-building`}
        value={building}
        onChange={(e) => onBuildingSelect(e.target.value)}
        className={selectClassName}
      >
        <option value="" disabled>
          건물을 선택하세요
        </option>
        {selectableBuildings.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={BUILDING_CUSTOM}>직접 작성</option>
      </select>
      <p className="text-xs text-muted-foreground">목록을 펼쳐 건물을 선택하거나, 맨 아래 직접 작성을 고르세요.</p>

      {isCustom ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-custom`}>직접 입력</Label>
          <Input
            id={`${idPrefix}-custom`}
            value={customText}
            onChange={(e) => onCustomTextChange(e.target.value)}
            placeholder={customPlaceholder}
          />
        </div>
      ) : building ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-detail`}>상세 위치</Label>
          <Input
            id={`${idPrefix}-detail`}
            value={detail}
            onChange={(e) => onDetailChange(e.target.value)}
            placeholder={detailPlaceholder}
          />
          <p className="text-xs text-muted-foreground">층·호수·장소명 등을 적어 주세요. (선택)</p>
        </div>
      ) : null}
    </div>
  );
}
