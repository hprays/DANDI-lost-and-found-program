"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock3, KeyRound, Loader2, MapPinned, Megaphone, Phone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ItemImage } from "@/components/item-image";
import { FavoriteButton, ReceivedOverlay } from "@/components/lost-item-card";
import { PickupQr } from "@/components/pickup-qr";
import { QAChatbot } from "@/components/qa-chatbot";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchAIGuidance, useDandiState } from "@/lib/dandi-state";
import { lostItems, officeMarkers } from "@/lib/mock-data";
import { useFavorites } from "@/lib/favorites";
import { findOfficeForStorage, formatRemaining } from "@/lib/item-filters";
import { applyLostItemAdminChanges } from "@/lib/custom-lost-items";
import { displayFoundDateTime, displayRegistrationDateTime } from "@/lib/format-display";
import { fetchLostItemById } from "@/lib/catalog-utils";
import { getPublishedLostItems, type PublishedLostItem } from "@/lib/published-lost-items";
import { lostItemPk } from "@/lib/catalog-identity";
import { getAuthSession } from "@/lib/auth-session";
import { pickupPassState, useNow } from "@/lib/pickup-pass-state";

const USE_MOCK_LOST_ITEMS = process.env.NEXT_PUBLIC_ENABLE_MOCK_LOST_ITEMS === "true";

export default function LostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const itemId = id;
  const { issuePickupPass, pickupPasses, homeLostItems, refreshPickupPasses } = useDandiState();
  // 1초 간격 — QR 남은 유효 시간을 실시간으로 표시
  const now = useNow(1000);
  const favorites = useFavorites();

  useEffect(() => {
    void refreshPickupPasses();
  }, [refreshPickupPasses]);
  const [fetchedItem, setFetchedItem] = useState<PublishedLostItem | null>(null);
  const [fetchingItem, setFetchingItem] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setFetchingItem(true);
    void fetchLostItemById(itemId).then((row) => {
      if (!cancelled) {
        setFetchedItem(row);
        setFetchingItem(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const item = useMemo(() => {
    const published = applyLostItemAdminChanges(homeLostItems);
    const stored = getPublishedLostItems();
    const merged = USE_MOCK_LOST_ITEMS
      ? applyLostItemAdminChanges([...published, ...stored, ...lostItems])
      : applyLostItemAdminChanges([...published, ...stored]);
    // 경로의 id는 물품 id — 신고 id(reportId)와 비교하지 않는다
    return (
      merged.find((it) => String(it.id) === itemId) ??
      (fetchedItem ? applyLostItemAdminChanges([fetchedItem])[0] : null)
    );
  }, [homeLostItems, itemId, fetchedItem]);
  const itemMemo = (item as { memo?: string } | null)?.memo?.trim() ?? "";
  const [aiGuide, setAiGuide] = useState<{ cautionTitle: string; cautions: string[]; chatbotTips: string[] } | null>(null);
  const loading = item !== null && aiGuide === null;
  const [issuingPickup, setIssuingPickup] = useState(false);
  const [pickupMessage, setPickupMessage] = useState("");
  const serverItemId = item ? lostItemPk(item as PublishedLostItem) : undefined;
  const itemReceived = /^(RECEIVED|PICKED_UP)$/i.test(
    String((item as PublishedLostItem | null)?.catalogStatus ?? "")
  );
  // 현재 계정의 이 물품 QR 중 가장 최근 것 (서버 목록 기준, 만료·사용 여부 포함)
  const latestPass = useMemo(() => {
    if (!serverItemId) return null;
    const email = getAuthSession()?.email;
    return (
      pickupPasses.find(
        (pass) =>
          pass.lostItemId === serverItemId && (!pass.claimantEmail || pass.claimantEmail === email)
      ) ?? null
    );
  }, [pickupPasses, serverItemId]);
  const latestPassState = latestPass ? pickupPassState(latestPass, now) : null;
  const remainingMs = latestPass ? Date.parse(latestPass.expiresAt) - now : 0;
  // 보관 장소가 등록되지 않으면 기본 보관실(혜당관 학생팀)로 안내
  const storageOffice =
    findOfficeForStorage(item?.storage, officeMarkers) ?? officeMarkers.find((o) => o.name === "혜당관 학생팀");

  const onIssuePickup = async () => {
    if (!item) return;
    setIssuingPickup(true);
    setPickupMessage("");
    try {
      const result = await issuePickupPass({
        lostItemId: serverItemId ?? "",
        itemName: item.name,
        itemImage: item.image,
        itemLocation: item.place,
      });
      setPickupMessage(result.message);
    } finally {
      setIssuingPickup(false);
    }
  };

  useEffect(() => {
    if (!item) return;
    let mounted = true;
    fetchAIGuidance({ name: item.name, category: item.category, type: item.type })
      .then((data) => {
        if (!mounted) return;
        setAiGuide(data);
      });
    return () => {
      mounted = false;
    };
  }, [item]);

  if (!item && fetchingItem) {
    return (
      <AppShell subtitle="분실물 상세 정보 및 수령 안내">
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            분실물 정보를 불러오는 중입니다...
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (!item) {
    return (
      <AppShell subtitle="분실물 상세 정보 및 수령 안내">
        <Card>
          <CardContent className="space-y-4 p-6">
            <h1 className="text-xl font-bold">해당 분실물을 찾을 수 없습니다.</h1>
            <p className="text-sm text-muted-foreground">목록이 갱신되었거나 삭제된 항목일 수 있습니다. 홈에서 다시 선택해 주세요.</p>
            <Button asChild>
              <Link href="/home">홈으로 이동</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell subtitle="분실물 상세 정보 및 수령 안내">
      <Card className="overflow-hidden">
        <div className="relative h-80 bg-slate-100 md:h-[32rem]">
          <ItemImage src={item.image} alt={item.name} category={item.category} sizes="(max-width: 768px) 100vw, 70vw" fit="contain" />
          {itemReceived || latestPassState === "used" ? <ReceivedOverlay large /> : null}
        </div>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Badge>{item.category}</Badge>
              <h1 className="text-2xl font-bold">{item.name}</h1>
            </div>
            <FavoriteButton
              active={favorites.isFavorite(String(item.id))}
              onToggle={() => favorites.toggle(String(item.id))}
              className="shrink-0 border"
            />
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <p>습득 위치: {item.place}</p>
            {(() => {
              const registered = displayRegistrationDateTime(item);
              const found = displayFoundDateTime(item);
              return (
                <>
                  {registered ? <p>등록 일시: {registered}</p> : <p>등록 일시: 시간 정보 없음</p>}
                  {found ? <p>습득 일시: {found}</p> : null}
                </>
              );
            })()}
            {item.storage ? <p>보관 장소: {item.storage}</p> : <p>보관 장소: 혜당관 학생팀 425호</p>}
          </div>

          {storageOffice ? (
            <div className="rounded-xl border bg-slate-50 p-4 text-sm">
              {/* 보관 호실과 관리실 호실이 다를 수 있어 보관 장소를 우선 표시하고 관리실은 문의처로 안내 */}
              <p className="font-semibold">수령 장소 · {item.storage || `${storageOffice.name} ${storageOffice.location}`}</p>
              <p className="text-muted-foreground">
                문의처: {storageOffice.name} {storageOffice.location}
              </p>
              <div className="mt-2 grid gap-1">
                <p className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-primary" />
                  {storageOffice.hours}
                </p>
                <a href={`tel:${storageOffice.phone}`} className="flex items-center gap-2 text-primary underline">
                  <Phone className="h-4 w-4" />
                  {storageOffice.phone}
                </a>
              </div>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href={`/map?office=${encodeURIComponent(storageOffice.name)}`}>
                  <MapPinned className="h-4 w-4" />
                  지도에서 위치 보기
                </Link>
              </Button>
            </div>
          ) : null}

          <Accordion type="single" collapsible className="rounded-xl border px-4">
            <AccordionItem value="details" className="border-none">
              <AccordionTrigger className="text-base">상세 정보 보기</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <p>제품 카테고리: {item.category}</p>
                  <p>종류: {item.type ?? "미지정"}</p>
                  <p>추가 정보: {itemMemo || "등록된 메모가 없습니다."}</p>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <AlertCircle className="h-4 w-4" />
                      {aiGuide?.cautionTitle ?? "AI 수령 주의사항"}
                    </p>
                    {loading ? (
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        생성형 AI가 수령 주의사항을 분석 중입니다...
                      </div>
                    ) : (
                      <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
                        {(aiGuide?.cautions ?? []).map((caution) => (
                          <li key={caution}>{caution}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card className="mt-4 border-primary/30 bg-primary/5">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-primary">내 물건이 맞나요? 수령 QR 발급</p>
          </div>
          <p className="text-xs text-muted-foreground">
            QR 발급 후 관리실을 방문하면 담당자가 본인 확인을 진행합니다. QR은 발급 시점부터 10분 동안 유효합니다.
          </p>
          {itemReceived || latestPassState === "used" ? (
            <p className="rounded-lg border bg-white p-3 text-sm font-semibold text-slate-700">
              수령이 완료된 물품입니다. QR을 발급할 수 없습니다.
            </p>
          ) : latestPass && latestPassState === "active" ? (
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground">발급된 수령 QR</p>
              <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center">
                <PickupQr value={latestPass.token} />
                <div className="space-y-1 text-sm">
                  <p className="text-base font-bold tracking-wider">{latestPass.token}</p>
                  <p className="text-lg font-bold text-primary" role="timer">
                    남은 시간 {formatRemaining(remainingMs)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    유효기간: {new Date(latestPass.expiresAt).toLocaleString("ko-KR", { hour12: false })}
                  </p>
                  <p className="text-xs font-semibold text-primary">관리실에서 QR 확인 대기 중</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {latestPassState === "expired" ? (
                <p className="text-xs font-semibold text-amber-700">
                  이전에 발급한 QR이 만료되었습니다. 새 QR을 발급받아 주세요.
                </p>
              ) : null}
              <Button onClick={onIssuePickup} disabled={issuingPickup || !serverItemId}>
                {issuingPickup ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {latestPassState === "expired" ? "수령 QR 다시 발급받기" : "내 물건 — 수령 QR 발급받기"}
              </Button>
            </>
          )}
          {pickupMessage ? <p className="text-xs font-medium text-primary">{pickupMessage}</p> : null}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Button asChild size="lg">
          <Link href="/map?from=detail&focus=current">
            <MapPinned className="h-4 w-4" />
            주인 찾아주세요 (지도 보기)
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/register-item">
            <Megaphone className="h-4 w-4" />
            물건 잃어버렸어요 (신고)
          </Link>
        </Button>
      </div>

      <QAChatbot tips={aiGuide?.chatbotTips} />
    </AppShell>
  );
}
