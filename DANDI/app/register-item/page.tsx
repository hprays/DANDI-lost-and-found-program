"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BuildingLocationPicker } from "@/components/building-location-picker";
import { useBuildingLocationField } from "@/lib/building-location";
import { getAuthSession } from "@/lib/auth-session";
import { safeRemoveLocalStorage, safeSetLocalStorage } from "@/lib/safe-local-storage";
import { useDandiState } from "@/lib/dandi-state";
import { formatDateTimeLabel, sanitizeLocation } from "@/lib/format-display";
import { resolveDisplayImageUrl } from "@/lib/media-url";
import { MAX_IMAGE_BYTES } from "@/lib/constants";
import { categories } from "@/lib/mock-data";

type ReportDraft = {
  itemName: string;
  dateTime: string;
  category: string;
  memo: string;
  building: string;
  detail: string;
  customText: string;
};

// 계정별 신고 임시 저장 — 사진은 용량 문제로 제외 (글·장소·일시만)
const draftKey = () => `dandi.reportDraft.v1:${getAuthSession()?.email ?? "guest"}`;

function readDraft(): Partial<ReportDraft> | null {
  try {
    const raw = window.localStorage.getItem(draftKey());
    return raw ? (JSON.parse(raw) as Partial<ReportDraft>) : null;
  } catch {
    return null;
  }
}

export default function RegisterItemPage() {
  const { reports, submitReport, deleteReport, apiConfigured, apiBaseUrl } = useDandiState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [dateTime, setDateTime] = useState("");
  const reportLocation = useBuildingLocationField();
  const [memo, setMemo] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const selectableCategories = categories.filter((c) => c !== "전체");
  const [category, setCategory] = useState<string>(selectableCategories[0] ?? "기타");
  const [savedMessage, setSavedMessage] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const { setBuilding, setDetail, setCustomText } = reportLocation;

  // 뒤로 가기·화면 닫기 후 다시 들어오면 작성 중이던 내용을 복구
  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      setItemName(draft.itemName ?? "");
      setDateTime(draft.dateTime ?? "");
      if (draft.category) setCategory(draft.category);
      setMemo(draft.memo ?? "");
      setBuilding(draft.building ?? "");
      setDetail(draft.detail ?? "");
      setCustomText(draft.customText ?? "");
      setDraftRestored(true);
    }
    setDraftReady(true);
  }, [setBuilding, setDetail, setCustomText]);

  const { building, detail, customText } = reportLocation;
  useEffect(() => {
    if (!draftReady) return;
    const draft: ReportDraft = { itemName, dateTime, category, memo, building, detail, customText };
    const empty = !itemName.trim() && !dateTime && !memo.trim() && !building && !detail.trim() && !customText.trim();
    if (empty) safeRemoveLocalStorage(draftKey());
    else safeSetLocalStorage(draftKey(), JSON.stringify(draft));
  }, [draftReady, itemName, dateTime, category, memo, building, detail, customText]);

  const discardDraft = () => {
    setItemName("");
    setDateTime("");
    setCategory(selectableCategories[0] ?? "기타");
    setMemo("");
    reportLocation.reset();
    setDraftRestored(false);
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      clearPhoto();
      return;
    }
    if (!file.type.startsWith("image/")) {
      setSavedMessage("이미지 파일만 업로드할 수 있습니다.");
      clearPhoto();
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setSavedMessage("사진 용량은 10MB 이하만 가능합니다.");
      clearPhoto();
      return;
    }

    setPhotoFile(file);
    setSavedMessage("");
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setPhotoPreview(result);
    };
    reader.onerror = () => {
      setSavedMessage("사진을 불러오지 못했습니다. 다시 시도해 주세요.");
      clearPhoto();
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async () => {
    if (!itemName.trim() || !dateTime || !reportLocation.isValid) {
      setSavedMessage("물품명, 일시, 신고 장소를 입력해 주세요.");
      return;
    }
    setIsSubmitting(true);
    try {
      const place = reportLocation.composed;
      const result = await submitReport({
        itemName: itemName.trim(),
        category,
        lostAt: dateTime,
        location: place,
        storage: place,
        memo: memo.trim(),
        image: photoPreview ?? undefined,
      });
      if (!result.ok) {
        setSavedMessage(result.message);
        return;
      }
      setItemName("");
      setDateTime("");
      reportLocation.reset();
      setMemo("");
      clearPhoto();
      setDraftRestored(false);
      setSavedMessage(result.message || "관리자에게 신고가 전달되었습니다. 처리 상태는 마이페이지에서 확인하세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell subtitle="분실/습득 정보를 신고하고 관리자에게 전달합니다.">
      <Card>
        <CardHeader>
          <CardTitle>분실물 신고</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!apiConfigured ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              백엔드 주소가 비어 있습니다. `.env.local`에 `NEXT_PUBLIC_API_BASE_URL`을 설정하세요.
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">연동 대상 API: {apiBaseUrl}</p>
          )}

          {draftRestored ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <span>작성 중이던 신고 내용을 불러왔습니다. (사진은 다시 선택해 주세요)</span>
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={discardDraft}>
                새로 작성
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>분실물 사진 (선택)</Label>
            <div className="relative h-40 w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
                onChange={onPhotoChange}
                aria-label="분실물 사진 선택"
              />
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="선택한 분실물 사진" className="pointer-events-none h-full w-full object-contain" />
              ) : (
                <div className="pointer-events-none flex h-full flex-col items-center justify-center gap-2 text-slate-500">
                  <ImagePlus className="h-8 w-8" />
                  <p className="text-sm font-medium">여기를 눌러 사진 업로드</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG · 최대 10MB</p>
                </div>
              )}
            </div>
            {photoFile ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
                <span className="truncate text-muted-foreground">{photoFile.name}</span>
                <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={clearPhoto}>
                  <X className="mr-1 h-4 w-4" />
                  사진 제거
                </Button>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-name">물품명</Label>
            <Input id="item-name" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="예: 에어팟 케이스" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-category">카테고리</Label>
            <select
              id="item-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">목록을 스크롤해 더 많은 카테고리를 선택할 수 있습니다.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-time">분실 일시</Label>
            <Input id="date-time" type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
          </div>

          <BuildingLocationPicker
            idPrefix="report-place"
            label="신고 장소"
            building={reportLocation.building}
            detail={reportLocation.detail}
            customText={reportLocation.customText}
            onBuildingChange={reportLocation.setBuilding}
            onDetailChange={reportLocation.setDetail}
            onCustomTextChange={reportLocation.setCustomText}
            detailPlaceholder="예: 1층 북카페, 214호 강의실"
          />
          <div className="space-y-2">
            <Label htmlFor="memo">상세 설명</Label>
            <Textarea
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="특징(색상, 스티커, 분실 경위 등)을 자세히 적어 주세요. 관리자가 검토하는 데 도움이 됩니다."
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <Button type="button" onClick={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              관리자에게 신고 보내기
            </Button>
            <Button type="button" variant="outline" onClick={() => setSavedMessage("아래 대기 목록에서 개별 삭제할 수 있습니다.")}>
              잘못 신고한 항목은 아래에서 삭제
            </Button>
          </div>
          {savedMessage ? <p className="text-sm font-medium text-primary">{savedMessage}</p> : null}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>관리자 전달 대기 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reports.filter((report) => report.status === "pending").length === 0 ? (
            <p className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">현재 관리자 전달 대기 항목이 없습니다.</p>
          ) : (
            reports
              .filter((report) => report.status === "pending")
              .map((report) => (
                <div key={report.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                  {(() => {
                    const thumb = resolveDisplayImageUrl(report.image);
                    return thumb ? (
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumb} alt={report.itemName} className="h-full w-full object-contain" />
                      </div>
                    ) : null;
                  })()}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{report.itemName}</p>
                    <p className="text-muted-foreground">
                      {report.category} · {sanitizeLocation(report.storage ?? report.location)} /{" "}
                      {formatDateTimeLabel(report.lostAt) || report.createdAt}
                    </p>
                    {report.memo ? <p className="mt-1 text-xs text-muted-foreground">메모: {report.memo}</p> : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={deletingId === report.id}
                    onClick={async () => {
                      setDeletingId(report.id);
                      try {
                        const result = await deleteReport(report.id);
                        setSavedMessage(result.message);
                      } finally {
                        setDeletingId(null);
                      }
                    }}
                  >
                    {deletingId === report.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    삭제
                  </Button>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
