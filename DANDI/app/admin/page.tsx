"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import Image from "next/image";
import { CheckCircle2, CircleX, Clock3, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getAuthSession } from "@/lib/auth-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  addCustomLostItem,
  applyLostItemAdminChanges,
  deleteCustomLostItem,
  getCustomLostItems,
  markLostItemDeleted,
  setLostItemOverride,
  updateCustomLostItem,
} from "@/lib/custom-lost-items";
import { useDandiState } from "@/lib/dandi-state";
import { lostItems } from "@/lib/mock-data";

export default function AdminPage() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";
  const { reports, resolveReport, pickupPasses, verifyPickupPass, adminAuditLogs, apiConfigured, apiBaseUrl } = useDandiState();
  const [regName, setRegName] = useState("");
  const [regCategory, setRegCategory] = useState("");
  const [regLocation, setRegLocation] = useState("");
  const [regFoundAt, setRegFoundAt] = useState("");
  const [regStorage, setRegStorage] = useState("");
  const [regMemo, setRegMemo] = useState("");
  const [regMessage, setRegMessage] = useState("");
  const [pickupToken, setPickupToken] = useState("");
  const [pickupMessage, setPickupMessage] = useState("");
  const [visionFile, setVisionFile] = useState<File | null>(null);
  const [visionPreview, setVisionPreview] = useState<string | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionMessage, setVisionMessage] = useState("");
  const [visionResultId, setVisionResultId] = useState("");
  const [visionResult, setVisionResult] = useState<{
    id?: string;
    category?: string;
    labels?: string[];
    rgb?: { r?: number; g?: number; b?: number };
    text?: string;
    colorName?: string;
  } | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [statusUpdatingType, setStatusUpdatingType] = useState<"resolved" | "unavailable" | null>(null);
  const [pickupVerifying, setPickupVerifying] = useState(false);
  const [registeredItems, setRegisteredItems] = useState<
    Array<{ id: string; name: string; category: string; location: string; storage: string; createdAt: string }>
  >([]);
  const [manageMessage, setManageMessage] = useState("");
  const [manageDrafts, setManageDrafts] = useState<
    Record<string, { name: string; category: string; type: string; place: string; time: string; memo: string }>
  >({});

  const rgbToColorName = (rgb?: { r?: number; g?: number; b?: number }) => {
    if (rgb?.r === undefined || rgb.g === undefined || rgb.b === undefined) return "-";
    const { r, g, b } = rgb;
    if (r > 200 && g > 200 && b > 200) return "밝은 계열";
    if (r < 70 && g < 70 && b < 70) return "어두운 계열";
    if (r > g + 40 && r > b + 40) return "붉은 계열";
    if (g > r + 40 && g > b + 40) return "초록 계열";
    if (b > r + 40 && b > g + 40) return "파란 계열";
    if (r > 170 && g > 140 && b < 90) return "노란/베이지 계열";
    return "중간톤";
  };

  const pendingReports = useMemo(() => reports.filter((report) => report.status === "pending"), [reports]);
  const processedReports = useMemo(() => reports.filter((report) => report.status !== "pending"), [reports]);
  const customIdSet = new Set(getCustomLostItems().map((item) => item.id));
  const managedItems = applyLostItemAdminChanges([...getCustomLostItems(), ...lostItems]);

  const registerItem = () => {
    if (!regName.trim() || !regCategory.trim() || !regLocation.trim() || !regFoundAt || !regStorage.trim()) {
      setRegMessage("물품명, 카테고리, 위치, 습득시간, 보관장소를 입력해 주세요.");
      return;
    }

    setRegisteredItems((prev) => [
      {
        id: `adm-${Date.now()}`,
        name: regName.trim(),
        category: regCategory.trim(),
        location: regLocation.trim(),
        storage: regStorage.trim(),
        createdAt: new Date().toLocaleString("ko-KR", { hour12: false }),
      },
      ...prev,
    ]);
    addCustomLostItem({
      id: `c-${Date.now()}`,
      name: regName.trim(),
      category: regCategory.trim(),
      type: "관리자 등록",
      memo: regMemo.trim(),
      place: regLocation.trim(),
      time: "방금 등록",
    });

    setRegName("");
    setRegCategory("");
    setRegLocation("");
    setRegFoundAt("");
    setRegStorage("");
    setRegMemo("");
    setRegMessage("등록 완료되었습니다.");
  };

  const clearLastRegistered = () => {
    setRegisteredItems((prev) => prev.slice(1));
    setRegMessage("최근 등록 항목을 삭제했습니다.");
  };

  const onVerifyPickup = async () => {
    setPickupVerifying(true);
    try {
      const result = await verifyPickupPass(pickupToken);
      setPickupMessage(result.message);
      if (result.ok) {
        setPickupToken("");
      }
    } finally {
      setPickupVerifying(false);
    }
  };

  const onVisionFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setVisionFile(file);
    setVisionResult(null);
    setVisionResultId("");
    setVisionMessage("");
    if (!file) {
      setVisionPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setVisionPreview(objectUrl);
  };

  const onAnalyzeVision = async () => {
    if (!visionFile) {
      setVisionMessage("먼저 분석할 이미지를 선택해 주세요.");
      return;
    }
    if (!API_BASE_URL) {
      setVisionMessage("NEXT_PUBLIC_API_BASE_URL 설정이 필요합니다.");
      return;
    }
    const session = getAuthSession();
    if (!session?.accessToken) {
      setVisionMessage("관리자 토큰이 없습니다. 다시 로그인해 주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("image", visionFile);

    setVisionLoading(true);
    setVisionMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/vision/analyze`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: formData,
      });
      if (!response.ok) {
        let serverMessage = "Vision 분석 요청에 실패했습니다.";
        try {
          const err = (await response.json()) as { message?: string; error?: string };
          serverMessage = err.message || err.error || serverMessage;
        } catch {
          // ignore
        }
        setVisionMessage(serverMessage);
        return;
      }
      const data = (await response.json()) as {
        id?: string;
        resultId?: string;
        category?: string;
        labels?: string[];
        rgb?: { r?: number; g?: number; b?: number };
        text?: string;
      };
      const resultId = data.id ?? data.resultId ?? "";
      const normalized = {
        id: resultId,
        category: data.category,
        labels: data.labels ?? [],
        rgb: data.rgb,
        text: data.text,
        colorName: rgbToColorName(data.rgb),
      };
      setVisionResult(normalized);
      setVisionResultId(resultId);
      setVisionMessage("Vision 분석이 완료되었습니다.");
    } catch (error) {
      setVisionMessage(error instanceof Error ? error.message : "Vision 분석 중 오류가 발생했습니다.");
    } finally {
      setVisionLoading(false);
    }
  };

  const onFetchVisionResult = async () => {
    if (!visionResultId.trim()) {
      setVisionMessage("조회할 분석 결과 ID를 입력해 주세요.");
      return;
    }
    if (!API_BASE_URL) {
      setVisionMessage("NEXT_PUBLIC_API_BASE_URL 설정이 필요합니다.");
      return;
    }
    const session = getAuthSession();
    if (!session?.accessToken) {
      setVisionMessage("관리자 토큰이 없습니다. 다시 로그인해 주세요.");
      return;
    }

    setVisionLoading(true);
    setVisionMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/vision/results/${encodeURIComponent(visionResultId.trim())}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
      if (!response.ok) {
        let serverMessage = "분석 결과 조회에 실패했습니다.";
        try {
          const err = (await response.json()) as { message?: string; error?: string };
          serverMessage = err.message || err.error || serverMessage;
        } catch {
          // ignore
        }
        setVisionMessage(serverMessage);
        return;
      }
      const data = (await response.json()) as {
        id?: string;
        category?: string;
        labels?: string[];
        rgb?: { r?: number; g?: number; b?: number };
        text?: string;
      };
      setVisionResult({
        id: data.id ?? visionResultId.trim(),
        category: data.category,
        labels: data.labels ?? [],
        rgb: data.rgb,
        text: data.text,
        colorName: rgbToColorName(data.rgb),
      });
      setVisionMessage("분석 결과를 불러왔습니다.");
    } catch (error) {
      setVisionMessage(error instanceof Error ? error.message : "분석 결과 조회 중 오류가 발생했습니다.");
    } finally {
      setVisionLoading(false);
    }
  };

  const onSaveManagedItem = (itemId: string) => {
    const origin = managedItems.find((it) => it.id === itemId);
    if (!origin) return;
    const draft = manageDrafts[itemId] ?? {
      name: origin.name ?? "",
      category: origin.category ?? "",
      type: origin.type ?? "",
      place: origin.place ?? "",
      time: origin.time ?? "",
      memo: (origin as { memo?: string }).memo ?? "",
    };

    if (!draft.name.trim() || !draft.category.trim() || !draft.place.trim() || !draft.time.trim()) {
      setManageMessage("물품명, 카테고리, 위치, 시간을 입력해 주세요.");
      return;
    }

    const patch = {
      name: draft.name.trim(),
      category: draft.category.trim(),
      type: draft.type.trim() || "미지정",
      place: draft.place.trim(),
      time: draft.time.trim(),
      memo: draft.memo.trim(),
    };

    if (customIdSet.has(itemId)) {
      updateCustomLostItem(itemId, patch);
    } else {
      setLostItemOverride(itemId, patch);
    }
    setManageMessage("관리자 수정이 저장되었습니다.");
  };

  const onDeleteManagedItem = (itemId: string) => {
    markLostItemDeleted(itemId);
    if (customIdSet.has(itemId)) {
      deleteCustomLostItem(itemId);
    }
    setManageMessage("해당 물품을 삭제했습니다.");
  };

  const onManageDraftChange = (
    itemId: string,
    field: "name" | "category" | "type" | "place" | "time" | "memo",
    value: string
  ) => {
    const origin = managedItems.find((it) => it.id === itemId);
    if (!origin) return;
    const base = manageDrafts[itemId] ?? {
      name: origin.name ?? "",
      category: origin.category ?? "",
      type: origin.type ?? "",
      place: origin.place ?? "",
      time: origin.time ?? "",
      memo: (origin as { memo?: string }).memo ?? "",
    };
    setManageDrafts((prev) => ({
      ...prev,
      [itemId]: {
        ...base,
        [field]: value,
      },
    }));
  };

  return (
    <AppShell subtitle="관리자 검수 및 상태 처리">
      <div className="space-y-4">
        {!apiConfigured ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            백엔드 주소가 비어 있습니다. `.env.local`에 `NEXT_PUBLIC_API_BASE_URL`을 설정하세요.
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">연동 대상 API: {apiBaseUrl}</p>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">검수 대기</p>
              <p className="mt-1 text-2xl font-bold">{pendingReports.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">습득/수령 완료</p>
              <p className="mt-1 text-2xl font-bold">
                {reports.filter((report) => report.status === "resolved" || report.status === "picked_up").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">습득 불가</p>
              <p className="mt-1 text-2xl font-bold">{reports.filter((report) => report.status === "unavailable").length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="register">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="register">물품 등록</TabsTrigger>
            <TabsTrigger value="manage">물품 관리</TabsTrigger>
            <TabsTrigger value="pending">검수 대기</TabsTrigger>
            <TabsTrigger value="pickup">수령 인증</TabsTrigger>
            <TabsTrigger value="processed">처리 완료</TabsTrigger>
            <TabsTrigger value="audit">작업 이력</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>관리자 물품 등록</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  관리자 계정 권한 기준으로 물품 등록/분석이 진행됩니다.
                </div>

                <div className="space-y-2">
                  <Label>사진 업로드</Label>
                  <label className="flex h-28 cursor-pointer items-center justify-center rounded-xl border border-dashed text-slate-500 hover:bg-slate-50">
                    {visionFile ? `선택됨: ${visionFile.name}` : "클릭하여 사진 업로드"}
                    <input type="file" accept="image/*" className="hidden" onChange={onVisionFileChange} />
                  </label>
                  <p className="text-xs text-muted-foreground">신분증은 사진 없이 텍스트 정보만 기록합니다.</p>
                  {visionPreview ? (
                    <div className="overflow-hidden rounded-lg border">
                      <div className="relative h-40 w-full">
                        <Image src={visionPreview} alt="vision-preview" fill className="object-cover" unoptimized />
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                    <Input value={visionResultId} onChange={(e) => setVisionResultId(e.target.value)} placeholder="분석 결과 ID 입력 후 조회" />
                    <div className="flex gap-2">
                      <Button variant="outline" type="button" onClick={onAnalyzeVision} disabled={visionLoading}>
                        {visionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Vision 분석
                      </Button>
                      <Button variant="outline" type="button" onClick={onFetchVisionResult} disabled={visionLoading}>
                        조회
                      </Button>
                    </div>
                  </div>
                  {visionMessage ? <p className="text-xs font-medium text-primary">{visionMessage}</p> : null}
                  {visionResult ? (
                    <div className="space-y-1 rounded-lg border bg-slate-50 p-3 text-xs">
                      <p>
                        <span className="font-semibold">분석 ID:</span> {visionResult.id ?? "-"}
                      </p>
                      <p>
                        <span className="font-semibold">카테고리:</span> {visionResult.category ?? "-"}
                      </p>
                      <p>
                        <span className="font-semibold">라벨:</span> {(visionResult.labels ?? []).join(", ") || "-"}
                      </p>
                      <p>
                        <span className="font-semibold">색상(RGB):</span>{" "}
                        {visionResult.rgb ? `${visionResult.rgb.r ?? "-"}, ${visionResult.rgb.g ?? "-"}, ${visionResult.rgb.b ?? "-"}` : "-"}
                      </p>
                      <p>
                        <span className="font-semibold">색상 텍스트:</span> {visionResult.colorName ?? "-"}
                      </p>
                      <p>
                        <span className="font-semibold">OCR 텍스트:</span> {visionResult.text?.slice(0, 120) || "-"}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">물품명</Label>
                    <Input id="reg-name" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="예: 검은색 반지갑" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-category">카테고리</Label>
                    <Input id="reg-category" value={regCategory} onChange={(e) => setRegCategory(e.target.value)} placeholder="예: 지갑/가방" />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="reg-location">습득 위치</Label>
                    <Input id="reg-location" value={regLocation} onChange={(e) => setRegLocation(e.target.value)} placeholder="예: 혜당관 1층" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-found-at">습득 시간</Label>
                    <Input id="reg-found-at" type="datetime-local" value={regFoundAt} onChange={(e) => setRegFoundAt(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-storage">보관 장소</Label>
                  <Input id="reg-storage" value={regStorage} onChange={(e) => setRegStorage(e.target.value)} placeholder="예: 혜당관 학생팀 425호" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-memo">추가 메모</Label>
                  <Textarea id="reg-memo" value={regMemo} onChange={(e) => setRegMemo(e.target.value)} placeholder="특징/인수인계 메모" />
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <Button onClick={registerItem}>등록 완료</Button>
                  <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={clearLastRegistered}>
                    등록 삭제
                  </Button>
                </div>
                {regMessage ? <p className="text-sm font-semibold text-primary">{regMessage}</p> : null}
              </CardContent>
            </Card>

            {registeredItems.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>등록된 물품 목록</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {registeredItems.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-semibold">
                        {item.name} / {item.category}
                      </p>
                      <p className="text-muted-foreground">
                        {item.location} / 보관: {item.storage}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.createdAt}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="manage" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>관리자 물품 수정/삭제</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {manageMessage ? <p className="text-sm font-semibold text-primary">{manageMessage}</p> : null}
                {managedItems.length === 0 ? (
                  <p className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">관리할 물품이 없습니다.</p>
                ) : (
                  managedItems.map((item) => {
                    const draft = manageDrafts[item.id] ?? {
                      name: item.name ?? "",
                      category: item.category ?? "",
                      type: item.type ?? "",
                      place: item.place ?? "",
                      time: item.time ?? "",
                      memo: (item as { memo?: string }).memo ?? "",
                    };
                    return (
                      <div key={item.id} className="space-y-2 rounded-xl border p-3">
                        <div className="grid gap-2 md:grid-cols-2">
                          <Input value={draft.name} onChange={(e) => onManageDraftChange(item.id, "name", e.target.value)} />
                          <Input value={draft.category} onChange={(e) => onManageDraftChange(item.id, "category", e.target.value)} />
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <Input value={draft.type} onChange={(e) => onManageDraftChange(item.id, "type", e.target.value)} placeholder="종류" />
                          <Input value={draft.time} onChange={(e) => onManageDraftChange(item.id, "time", e.target.value)} placeholder="시간" />
                        </div>
                        <Input value={draft.place} onChange={(e) => onManageDraftChange(item.id, "place", e.target.value)} placeholder="위치" />
                        <Textarea value={draft.memo} onChange={(e) => onManageDraftChange(item.id, "memo", e.target.value)} placeholder="추가 정보" />
                        <div className="grid gap-2 md:grid-cols-2">
                          <Button type="button" onClick={() => onSaveManagedItem(item.id)}>
                            수정 저장
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => onDeleteManagedItem(item.id)}
                          >
                            삭제
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="space-y-3">
            {pendingReports.length === 0 ? (
              <p className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">현재 검수 대기 중인 신고가 없습니다.</p>
            ) : (
              pendingReports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{report.itemName}</p>
                      <Badge>{report.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {report.location} / 접수: {report.createdAt}
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Button
                        variant="outline"
                        disabled={statusUpdatingId === report.id}
                        onClick={async () => {
                          setStatusUpdatingId(report.id);
                          setStatusUpdatingType("resolved");
                          try {
                            const result = await resolveReport(report.id, "resolved");
                            setRegMessage(result.message);
                          } finally {
                            setStatusUpdatingId(null);
                            setStatusUpdatingType(null);
                          }
                        }}
                      >
                        {statusUpdatingId === report.id && statusUpdatingType === "resolved" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        습득 완료 처리
                      </Button>
                      <Button
                        variant="outline"
                        disabled={statusUpdatingId === report.id}
                        onClick={async () => {
                          setStatusUpdatingId(report.id);
                          setStatusUpdatingType("unavailable");
                          try {
                            const result = await resolveReport(report.id, "unavailable");
                            setRegMessage(result.message);
                          } finally {
                            setStatusUpdatingId(null);
                            setStatusUpdatingType(null);
                          }
                        }}
                      >
                        {statusUpdatingId === report.id && statusUpdatingType === "unavailable" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CircleX className="h-4 w-4" />
                        )}
                        습득 불가 처리
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="processed" className="space-y-2">
            {processedReports.length === 0 ? (
              <p className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">처리 완료된 신고 이력이 없습니다.</p>
            ) : (
              processedReports.map((report) => (
                <div key={report.id} className="rounded-xl border bg-white p-3 text-sm">
                  <p className="font-semibold">{report.itemName}</p>
                  <p className="text-muted-foreground">{report.location}</p>
                  <p className="mt-1 text-xs font-semibold text-primary">
                    {report.status === "resolved" ? "습득 완료" : report.status === "picked_up" ? "최종 수령 완료" : "습득 불가"} /{" "}
                    {report.createdAt}
                  </p>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="pickup" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>QR 최종 수령 인증</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={pickupToken} onChange={(e) => setPickupToken(e.target.value)} placeholder="사용자 QR 코드 입력 (예: DKU-123456)" />
                  <Button onClick={onVerifyPickup} disabled={pickupVerifying}>
                    {pickupVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    수령 인증 완료
                  </Button>
                </div>
                {pickupMessage ? <p className="text-sm font-semibold text-primary">{pickupMessage}</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>발급된 수령 코드</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pickupPasses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">발급된 수령 코드가 없습니다.</p>
                ) : (
                  pickupPasses.map((pass) => (
                    <div key={pass.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-semibold">{pass.token}</p>
                      <p className="text-muted-foreground">
                        신고 ID: {pass.reportId} / 만료: {new Date(pass.expiresAt).toLocaleString("ko-KR", { hour12: false })}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-primary">{pass.usedAt ? `인증 완료 (${pass.usedAt})` : "미사용"}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-2">
            {adminAuditLogs.map((log) => (
              <div key={log.id} className="rounded-xl border bg-white p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Clock3 className="h-4 w-4 text-primary" />
                  {log.message}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{log.createdAt}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
