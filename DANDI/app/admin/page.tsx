"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Camera, CameraOff, CheckCircle2, CircleX, Clock3, Loader2, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getAuthSession, type AuthSession } from "@/lib/auth-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { applyLostItemAdminChanges, markLostItemDeleted, setLostItemOverride } from "@/lib/custom-lost-items";
import { useDandiState } from "@/lib/dandi-state";
import { formatDateTimeLabel, sanitizeLocation } from "@/lib/format-display";
import { categories } from "@/lib/mock-data";

const selectableCategories = categories.filter((c) => c !== "전체");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type ManageDraft = {
  name: string;
  category: string;
  type: string;
  place: string;
  foundAt: string;
  storage: string;
  memo: string;
  image: string;
};

function toDatetimeLocalValue(timeStr: string): string {
  if (!timeStr) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timeStr)) return timeStr.slice(0, 16);
  const parsed = new Date(timeStr);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function formatFoundAtLabel(foundAt: string): string {
  if (!foundAt) return "";
  const parsed = new Date(foundAt);
  if (Number.isNaN(parsed.getTime())) return foundAt;
  return parsed.toLocaleString("ko-KR", { hour12: false });
}

function buildManageDraft(item: { name?: string; category?: string; type?: string; place?: string; time?: string; memo?: string; image?: string; storage?: string }): ManageDraft {
  return {
    name: item.name ?? "",
    category: item.category ?? selectableCategories[0] ?? "기타",
    type: item.type ?? "",
    place: item.place ?? "",
    foundAt: toDatetimeLocalValue(item.time ?? ""),
    storage: item.storage ?? "",
    memo: item.memo ?? "",
    image: item.image ?? "",
  };
}

export default function AdminPage() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";
  const {
    reports,
    resolveReport,
    pickupPasses,
    verifyPickupPass,
    adminAuditLogs,
    apiConfigured,
    apiBaseUrl,
    submitReport,
    homeLostItems,
    updateHomeLostItem,
    removeHomeLostItem,
  } = useDandiState();

  const [adminCheckSession, setAdminCheckSession] = useState<AuthSession | null>(null);
  const [adminChecked, setAdminChecked] = useState(false);
  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setAdminCheckSession(getAuthSession());
      setAdminChecked(true);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, []);
  const isAdmin = Boolean(adminCheckSession?.isAdmin);
  const [regName, setRegName] = useState("");
  const [regCategory, setRegCategory] = useState(selectableCategories[0] ?? "기타");
  const [regLocation, setRegLocation] = useState("");
  const [regFoundAt, setRegFoundAt] = useState("");
  const [regStorage, setRegStorage] = useState("");
  const [regMemo, setRegMemo] = useState("");
  const [regMessage, setRegMessage] = useState("");
  const [pickupToken, setPickupToken] = useState("");
  const [pickupMessage, setPickupMessage] = useState("");
  const [visionFile, setVisionFile] = useState<File | null>(null);
  const [visionPreview, setVisionPreview] = useState<string | null>(null);
  const [visionDataUrl, setVisionDataUrl] = useState<string | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionMessage, setVisionMessage] = useState("");
  const [visionResultId, setVisionResultId] = useState("");
  const [visionResult, setVisionResult] = useState<{
    id?: string;
    category?: string;
    labels?: string[];
    dominantColor?: string;
    text?: string;
  } | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [statusUpdatingType, setStatusUpdatingType] = useState<"resolved" | "unavailable" | null>(null);
  const [pickupVerifying, setPickupVerifying] = useState(false);
  const [pickupSearch, setPickupSearch] = useState("");
  const [pickupTokens, setPickupTokens] = useState<Record<string, string>>({});
  const [lastVerifiedPass, setLastVerifiedPass] = useState<
    { itemName?: string; claimantName?: string; claimantEmail?: string; usedAt: string | null } | null
  >(null);
  const [registering, setRegistering] = useState(false);
  const [registeredItems, setRegisteredItems] = useState<
    Array<{ id: string; name: string; category: string; location: string; storage: string; createdAt: string }>
  >([]);
  const [manageMessage, setManageMessage] = useState("");
  const [manageDrafts, setManageDrafts] = useState<Record<string, ManageDraft>>({});

  const pendingReports = useMemo(() => reports.filter((report) => report.status === "pending"), [reports]);
  const processedReports = useMemo(() => reports.filter((report) => report.status !== "pending"), [reports]);
  const managedItems = useMemo(() => applyLostItemAdminChanges(homeLostItems), [homeLostItems]);

  const registerItem = async () => {
    if (!regName.trim() || !regCategory.trim() || !regLocation.trim() || !regFoundAt || !regStorage.trim()) {
      setRegMessage("물품명, 카테고리, 위치, 습득시간, 보관장소를 입력해 주세요.");
      return;
    }

    setRegistering(true);
    // 관리자 등록 시에도 검수 대기 목록으로 들어가도록 신고 레코드를 함께 생성합니다.
    const submitResult = await submitReport({
      itemName: regName.trim(),
      category: regCategory.trim(),
      lostAt: regFoundAt,
      location: regLocation.trim(),
      storage: regStorage.trim(),
      memo: regMemo.trim(),
      image: visionDataUrl ?? undefined,
    });

    if (!submitResult.ok) {
      setRegMessage(submitResult.message);
      setRegistering(false);
      return;
    }

    setRegisteredItems((prev) => [
      {
        id: submitResult.reportId ?? `adm-${Date.now()}`,
        name: regName.trim(),
        category: regCategory.trim(),
        location: regLocation.trim(),
        storage: regStorage.trim(),
        createdAt: new Date().toLocaleString("ko-KR", { hour12: false }),
      },
      ...prev,
    ]);

    setRegName("");
    setRegCategory(selectableCategories[0] ?? "기타");
    setRegLocation("");
    setRegFoundAt("");
    setRegStorage("");
    setRegMemo("");
    setVisionDataUrl(null);
    setVisionPreview(null);
    setVisionFile(null);
    setRegMessage("등록 완료되었습니다. 검수 대기에서 습득 완료 처리 후 홈에 노출됩니다.");
    setRegistering(false);
  };

  const clearLastRegistered = () => {
    setRegisteredItems((prev) => prev.slice(1));
    setRegMessage("최근 등록 항목을 삭제했습니다.");
  };

  const onVerifyPickup = async (token: string, itemId?: string) => {
    if (!token.trim()) {
      setPickupMessage("QR 코드를 입력해 주세요.");
      return;
    }
    setPickupVerifying(true);
    try {
      const result = await verifyPickupPass(token);
      setPickupMessage(result.message);
      if (result.ok) {
        setPickupToken("");
        if (itemId) {
          setPickupTokens((prev) => ({ ...prev, [itemId]: "" }));
        }
        if (result.pass) {
          setLastVerifiedPass({
            itemName: result.pass.itemName,
            claimantName: result.pass.claimantName,
            claimantEmail: result.pass.claimantEmail,
            usedAt: result.pass.usedAt,
          });
        }
      }
    } finally {
      setPickupVerifying(false);
    }
  };

  // === 카메라 기반 QR 인증 시뮬레이션 ===
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanToken, setScanToken] = useState("");
  const [confirmIdCheck, setConfirmIdCheck] = useState(false);
  const [confirmCardCheck, setConfirmCardCheck] = useState(false);
  const [scannedPass, setScannedPass] = useState<typeof lastVerifiedPass>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 카메라 스트림이 준비되면 video 엘리먼트에 연결
  useEffect(() => {
    if (cameraOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      void videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen, cameraStream]);

  // 페이지 떠날 때 카메라 자원 정리
  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  const openCamera = async () => {
    setCameraError(null);
    setScannedPass(null);
    setConfirmIdCheck(false);
    setConfirmCardCheck(false);
    setScanToken("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      setCameraOpen(true);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "카메라를 사용할 수 없습니다.");
      setCameraOpen(true);
    }
  };

  const closeCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraOpen(false);
  };

  const onScanFromCamera = () => {
    // 실제 QR 디코딩 라이브러리 대신 입력값을 인식 결과로 사용 (현장에서는 BarcodeDetector 등을 도입)
    if (!scanToken.trim()) {
      setCameraError("스캔된 QR 토큰을 입력해 주세요. (예: DKU-123456)");
      return;
    }
    const target = pickupPasses.find((p) => p.token.toUpperCase() === scanToken.trim().toUpperCase());
    if (!target) {
      setCameraError("해당 토큰의 수령 QR이 발견되지 않았습니다. 분실자에게 다시 확인해 주세요.");
      return;
    }
    setScannedPass({
      itemName: target.itemName,
      claimantName: target.claimantName,
      claimantEmail: target.claimantEmail,
      usedAt: target.usedAt,
    });
    setCameraError(null);
  };

  const onFinalizePickup = async () => {
    if (!scannedPass) return;
    if (!confirmIdCheck) {
      setCameraError("신분증/학생증 확인 체크가 필요합니다.");
      return;
    }
    setCameraError(null);
    await onVerifyPickup(scanToken);
    closeCamera();
  };

  const pickupSearchResults = useMemo(() => {
    const keyword = pickupSearch.trim().toLowerCase();
    if (!keyword) return managedItems.slice(0, 6);
    return managedItems.filter((item) => {
      const haystack = [item.name, item.category, item.type, item.place, (item as { memo?: string }).memo]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [managedItems, pickupSearch]);

  const onVisionFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setVisionFile(file);
    setVisionResult(null);
    setVisionResultId("");
    setVisionMessage("");
    if (!file) {
      setVisionPreview(null);
      setVisionDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setVisionPreview(result);
      setVisionDataUrl(result);
    };
    reader.readAsDataURL(file);
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
        id?: string | number;
        resultId?: string | number;
        documentType?: string;
        category?: string;
        objectLabels?: string[];
        labels?: string[];
        dominantColors?: string[];
        maskedText?: string;
        text?: string;
      };
      const resultId = String(data.id ?? data.resultId ?? "");
      const normalized = {
        id: resultId,
        category: data.documentType ?? data.category,
        labels: data.objectLabels ?? data.labels ?? [],
        dominantColor: data.dominantColors?.[0] ?? "-",
        text: data.maskedText ?? data.text,
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
        id?: string | number;
        documentType?: string;
        category?: string;
        objectLabels?: string[];
        labels?: string[];
        dominantColors?: string[];
        maskedText?: string;
        text?: string;
      };
      setVisionResult({
        id: String(data.id ?? visionResultId.trim()),
        category: data.documentType ?? data.category,
        labels: data.objectLabels ?? data.labels ?? [],
        dominantColor: data.dominantColors?.[0] ?? "-",
        text: data.maskedText ?? data.text,
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
    const draft = manageDrafts[itemId] ?? buildManageDraft(origin);

    const savedTime = draft.foundAt.trim()
      ? formatFoundAtLabel(draft.foundAt) || draft.foundAt.trim()
      : (origin.time?.trim() ?? "");

    if (!draft.name.trim() || !draft.category.trim() || !draft.place.trim()) {
      setManageMessage("물품명, 카테고리, 습득 위치를 입력해 주세요.");
      return;
    }

    const patch = {
      name: draft.name.trim(),
      category: draft.category.trim(),
      type: draft.type.trim() || undefined,
      place: draft.place.trim(),
      time: savedTime,
      storage: draft.storage.trim(),
      memo: draft.memo.trim(),
      image: draft.image || undefined,
    };

    updateHomeLostItem(itemId, patch);
    setLostItemOverride(itemId, patch);
    setManageDrafts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setManageMessage("관리자 수정이 저장되었습니다.");
  };

  const onDeleteManagedItem = (itemId: string) => {
    markLostItemDeleted(itemId);
    removeHomeLostItem(itemId);
    setManageMessage("해당 물품을 삭제했습니다.");
  };

  const onManageDraftChange = (itemId: string, field: keyof ManageDraft, value: string) => {
    const origin = managedItems.find((it) => it.id === itemId);
    if (!origin) return;
    const base = manageDrafts[itemId] ?? buildManageDraft(origin);
    setManageDrafts((prev) => ({
      ...prev,
      [itemId]: {
        ...base,
        [field]: value,
      },
    }));
  };

  const onManagePhotoChange = (itemId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setManageMessage("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setManageMessage("사진 용량은 5MB 이하만 가능합니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      onManageDraftChange(itemId, "image", result);
      setManageMessage("");
    };
    reader.readAsDataURL(file);
  };

  if (adminChecked && !isAdmin) {
    return (
      <AppShell subtitle="관리자 전용 페이지">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-amber-700">
              <ShieldAlert className="h-5 w-5" />
              <p className="text-base font-semibold">접근 권한이 없습니다</p>
            </div>
            <p className="text-sm text-muted-foreground">
              관리자 페이지는 사전에 등록된 관리자 계정만 접근할 수 있습니다. 권한이 필요하다면 시스템 관리자에게 요청해 주세요.
            </p>
            <p className="text-xs text-muted-foreground">
              현재 로그인 이메일: <b>{adminCheckSession?.email ?? "-"}</b>
            </p>
            <Button asChild variant="outline">
              <Link href="/home">홈으로 이동</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

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
            <TabsTrigger value="register">관리자 분실물 등록</TabsTrigger>
            <TabsTrigger value="manage">물품 관리</TabsTrigger>
            <TabsTrigger value="pending">검수 대기</TabsTrigger>
            <TabsTrigger value="pickup">수령 인증</TabsTrigger>
            <TabsTrigger value="processed">처리 완료</TabsTrigger>
            <TabsTrigger value="audit">작업 이력</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>관리자 분실물 등록</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  관리자 계정 권한 기준으로 물품 등록/분석이 진행됩니다. 등록한 물품은 사용자 분실 신고와 동일하게{" "}
                  <b>검수 대기</b>에 들어가며, 습득 완료/불가 처리 후 홈·마이페이지에 반영됩니다.
                </div>

                <div className="space-y-2">
                  <Label>사진 업로드</Label>
                  <div className="relative h-28 w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
                      onChange={onVisionFileChange}
                      aria-label="물품 사진 선택"
                    />
                    <div className="pointer-events-none flex h-full items-center justify-center px-3 text-center text-sm text-slate-500">
                      {visionFile ? `선택됨: ${visionFile.name}` : "여기를 눌러 사진 업로드"}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">신분증은 사진 없이 텍스트 정보만 기록합니다.</p>
                  {visionPreview ? (
                    <div className="overflow-hidden rounded-lg border">
                      <div className="relative h-64 w-full bg-slate-50 md:h-80">
                        <Image src={visionPreview} alt="vision-preview" fill className="object-contain object-center" unoptimized />
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
                        <span className="font-semibold">대표 색상:</span> {visionResult.dominantColor ?? "-"}
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
                    <select
                      id="reg-category"
                      value={regCategory}
                      onChange={(e) => setRegCategory(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {selectableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">목록을 스크롤해 카테고리를 선택할 수 있습니다.</p>
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
                  <Button onClick={registerItem} disabled={registering}>
                    {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    등록 완료
                  </Button>
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
                  <p className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                    습득 완료 처리된 물품만 관리할 수 있습니다. 검수 대기에서 습득 완료 후 이 목록에 표시됩니다.
                  </p>
                ) : (
                  managedItems.map((item) => {
                    const draft = manageDrafts[item.id] ?? buildManageDraft(item);
                    return (
                      <div key={item.id} className="space-y-4 rounded-xl border bg-white p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">물품 ID: {item.id}</p>
                          <Badge variant="secondary">{item.category}</Badge>
                        </div>

                        <div className="space-y-2">
                          <Label>물품 사진</Label>
                          <div className="relative h-40 w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                            <input
                              type="file"
                              accept="image/*"
                              className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
                              onChange={(e) => onManagePhotoChange(item.id, e)}
                              aria-label={`${item.name} 사진 변경`}
                            />
                            {draft.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={draft.image} alt={draft.name} className="pointer-events-none h-full w-full object-contain" />
                            ) : (
                              <div className="pointer-events-none flex h-full items-center justify-center text-sm text-slate-500">
                                여기를 눌러 사진 업로드/변경
                              </div>
                            )}
                          </div>
                          {draft.image ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => onManageDraftChange(item.id, "image", "")}>
                              사진 제거
                            </Button>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`manage-name-${item.id}`}>물품명</Label>
                          <Input
                            id={`manage-name-${item.id}`}
                            value={draft.name}
                            onChange={(e) => onManageDraftChange(item.id, "name", e.target.value)}
                            placeholder="예: 에어팟"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`manage-category-${item.id}`}>카테고리</Label>
                          <select
                            id={`manage-category-${item.id}`}
                            value={draft.category}
                            onChange={(e) => onManageDraftChange(item.id, "category", e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            {selectableCategories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`manage-place-${item.id}`}>습득 위치</Label>
                            <Input
                              id={`manage-place-${item.id}`}
                              value={draft.place}
                              onChange={(e) => onManageDraftChange(item.id, "place", e.target.value)}
                              placeholder="예: 혜당관 2층"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`manage-found-at-${item.id}`}>습득 시간</Label>
                            <Input
                              id={`manage-found-at-${item.id}`}
                              type="datetime-local"
                              value={draft.foundAt}
                              onChange={(e) => onManageDraftChange(item.id, "foundAt", e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`manage-storage-${item.id}`}>보관 장소</Label>
                          <Input
                            id={`manage-storage-${item.id}`}
                            value={draft.storage}
                            onChange={(e) => onManageDraftChange(item.id, "storage", e.target.value)}
                            placeholder="예: 혜당관 학생팀 425호"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`manage-type-${item.id}`}>물품 상세종류</Label>
                          <Input
                            id={`manage-type-${item.id}`}
                            value={draft.type}
                            onChange={(e) => onManageDraftChange(item.id, "type", e.target.value)}
                            placeholder="예: 무선이어폰"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`manage-memo-${item.id}`}>상세 사항</Label>
                          <Textarea
                            id={`manage-memo-${item.id}`}
                            value={draft.memo}
                            onChange={(e) => onManageDraftChange(item.id, "memo", e.target.value)}
                            placeholder="특징, 색상, 추가 설명"
                          />
                        </div>

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
                    {report.image ? (
                      <div className="overflow-hidden rounded-lg border bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={report.image} alt={report.itemName} className="mx-auto max-h-56 w-full object-contain" />
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{report.itemName}</p>
                      <Badge>{report.category}</Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>위치: {sanitizeLocation(report.location)}</p>
                      {report.storage ? <p>보관 장소: {sanitizeLocation(report.storage)}</p> : null}
                      <p>분실/습득 일시: {formatDateTimeLabel(report.lostAt) || "-"}</p>
                      <p>접수: {report.createdAt}</p>
                      {report.ownerName || report.ownerEmail ? (
                        <p>
                          신고자: {report.ownerName ?? "이름 없음"}{" "}
                          {report.ownerEmail ? <>({report.ownerEmail})</> : null}
                        </p>
                      ) : null}
                      {report.memo ? (
                        <div className="mt-2 rounded-lg border bg-slate-50 p-2 text-foreground">
                          <p className="text-xs font-semibold text-muted-foreground">신고 상세 설명</p>
                          <p className="whitespace-pre-wrap text-sm">{report.memo}</p>
                        </div>
                      ) : null}
                    </div>
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
                  <p className="text-muted-foreground">{sanitizeLocation(report.location)}</p>
                  <p className="mt-1 text-xs font-semibold text-primary">
                    {report.status === "resolved" ? "습득 완료" : report.status === "picked_up" ? "최종 수령 완료" : "습득 불가"} /{" "}
                    {report.createdAt}
                  </p>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="pickup" className="space-y-3">
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  카메라로 QR 인증 시작
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  카메라로 분실자의 수령 QR을 스캔하면 인수자 정보가 자동 표시됩니다. 신분증/학생증을 직접 확인한 뒤 최종 인증을 진행하세요.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {!cameraOpen ? (
                  <Button onClick={() => void openCamera()}>
                    <Camera className="h-4 w-4" />
                    카메라 열기
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-lg border bg-black">
                      {cameraError && !cameraStream ? (
                        <div className="flex h-48 items-center justify-center bg-slate-900 px-4 text-center text-xs text-red-200">
                          {cameraError}
                        </div>
                      ) : (
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="h-56 w-full object-cover"
                        />
                      )}
                      <div className="pointer-events-none absolute inset-6 rounded-md border-2 border-white/70" />
                      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
                        QR 인식 영역
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="scan-token">스캔된 QR 토큰 (예: DKU-123456)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="scan-token"
                          value={scanToken}
                          onChange={(e) => setScanToken(e.target.value)}
                          placeholder="QR 토큰을 자동/수동으로 입력"
                        />
                        <Button type="button" variant="outline" onClick={onScanFromCamera}>
                          인식 결과 확인
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        ※ 현장 카메라 스캔 라이브러리(BarcodeDetector 등)는 백엔드/PWA 환경 설정 후 연동 예정. 지금은 인식된 토큰을 입력해 확인합니다.
                      </p>
                    </div>

                    {scannedPass ? (
                      <div className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                        <p className="font-semibold">인수자/물품 확인</p>
                        <ul className="space-y-1 text-sm">
                          <li>물품: {scannedPass.itemName ?? "-"}</li>
                          <li>인수자: {scannedPass.claimantName ?? "이름 없음"}</li>
                          <li>이메일: {scannedPass.claimantEmail ?? "이메일 없음"}</li>
                        </ul>

                        <div className="space-y-2 rounded-md border border-emerald-200 bg-white p-3 text-xs text-slate-800">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={confirmIdCheck}
                              onChange={(e) => setConfirmIdCheck(e.target.checked)}
                            />
                            <span>학생증 또는 신분증 본인 확인 완료 (사진은 저장하지 않으며, 확인 시 즉시 마스킹 처리)</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={confirmCardCheck}
                              onChange={(e) => setConfirmCardCheck(e.target.checked)}
                            />
                            <span>실물/카드(체크카드 등) 일치 여부 확인 (선택)</span>
                          </label>
                        </div>

                        <div className="flex gap-2">
                          <Button onClick={() => void onFinalizePickup()} disabled={pickupVerifying || !confirmIdCheck}>
                            {pickupVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            최종 수령 인증 완료
                          </Button>
                          <Button variant="outline" onClick={closeCamera}>
                            <CameraOff className="h-4 w-4" />
                            카메라 종료
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" onClick={closeCamera}>
                        <CameraOff className="h-4 w-4" />
                        카메라 종료
                      </Button>
                    )}

                    {cameraError ? <p className="text-xs text-red-600">{cameraError}</p> : null}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>분실자가 말한 물품 검색 후 QR 인증</CardTitle>
                <p className="text-sm text-muted-foreground">
                  카메라가 어려울 때는 키워드 검색으로 물품을 찾아 카드별 QR 입력으로도 인증할 수 있습니다.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={pickupSearch}
                  onChange={(e) => setPickupSearch(e.target.value)}
                  placeholder="검색 (예: 에어팟, 검정 지갑, 혜당관)"
                />
                {pickupMessage ? <p className="text-sm font-semibold text-primary">{pickupMessage}</p> : null}
                {pickupSearchResults.length === 0 ? (
                  <p className="rounded-lg border bg-slate-50 p-3 text-sm text-muted-foreground">검색 결과가 없습니다.</p>
                ) : (
                  pickupSearchResults.map((item) => {
                    const draftToken = pickupTokens[item.id] ?? "";
                    return (
                      <div key={item.id} className="rounded-xl border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{item.name}</p>
                          <Badge variant="secondary">{item.category}</Badge>
                        </div>
                        <p className="text-muted-foreground">{item.place}</p>
                        <div className="mt-3 flex gap-2">
                          <Input
                            value={draftToken}
                            onChange={(e) => setPickupTokens((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="분실자 QR 코드 입력 (예: DKU-123456)"
                          />
                          <Button
                            type="button"
                            onClick={() => void onVerifyPickup(draftToken, item.id)}
                            disabled={pickupVerifying}
                          >
                            {pickupVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            인증 완료
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>빠른 QR 인증 (토큰 직접 입력)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={pickupToken}
                    onChange={(e) => setPickupToken(e.target.value)}
                    placeholder="사용자 QR 코드 입력 (예: DKU-123456)"
                  />
                  <Button onClick={() => void onVerifyPickup(pickupToken)} disabled={pickupVerifying}>
                    {pickupVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    수령 인증 완료
                  </Button>
                </div>
                {lastVerifiedPass ? (
                  <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <p className="font-semibold">최근 인증 완료</p>
                    <p>물품: {lastVerifiedPass.itemName ?? "-"}</p>
                    <p>인수자: {lastVerifiedPass.claimantName ?? "이름 없음"}</p>
                    <p>이메일: {lastVerifiedPass.claimantEmail ?? "이메일 없음"}</p>
                    <p className="text-xs text-emerald-700">{lastVerifiedPass.usedAt ?? ""}</p>
                  </div>
                ) : null}
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
                      <div className="flex items-center justify-between">
                        <p className="font-semibold tracking-wider">{pass.token}</p>
                        <Badge variant={pass.usedAt ? "secondary" : "default"}>{pass.usedAt ? "인증 완료" : "미사용"}</Badge>
                      </div>
                      <p className="text-muted-foreground">
                        물품: {pass.itemName ?? "-"} / 위치: {pass.itemLocation ?? "-"}
                      </p>
                      <p className="text-muted-foreground">
                        인수자: {pass.claimantName ?? "이름 없음"} ({pass.claimantEmail ?? "이메일 없음"})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        만료: {new Date(pass.expiresAt).toLocaleString("ko-KR", { hour12: false })}
                      </p>
                      {pass.usedAt ? (
                        <p className="mt-1 text-xs font-semibold text-primary">수령 완료: {pass.usedAt}</p>
                      ) : null}
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
