"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { AlertCircle, KeyRound, Loader2, MapPinned, Megaphone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ItemImage } from "@/components/item-image";
import { PickupQr } from "@/components/pickup-qr";
import { QAChatbot } from "@/components/qa-chatbot";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchAIGuidance, useDandiState } from "@/lib/dandi-state";
import { lostItems } from "@/lib/mock-data";
import { applyLostItemAdminChanges } from "@/lib/custom-lost-items";
import { displayFoundDateTime, displayRegistrationDateTime } from "@/lib/format-display";
import { fetchLostItemById } from "@/lib/catalog-utils";
import { getPublishedLostItems, type PublishedLostItem } from "@/lib/published-lost-items";

const USE_MOCK_LOST_ITEMS = process.env.NEXT_PUBLIC_ENABLE_MOCK_LOST_ITEMS === "true";

export default function LostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const itemId = id;
  const { issuePickupPass, pickupPasses, homeLostItems } = useDandiState();
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
    return (
      merged.find((it) => String(it.id) === itemId) ??
      merged.find((it) => {
        const reportId = (it as PublishedLostItem).reportId;
        return reportId != null && String(reportId) === itemId;
      }) ??
      (fetchedItem ? applyLostItemAdminChanges([fetchedItem])[0] : null)
    );
  }, [homeLostItems, itemId, fetchedItem]);
  const itemMemo = (item as { memo?: string } | null)?.memo?.trim() ?? "";
  const [aiGuide, setAiGuide] = useState<{ cautionTitle: string; cautions: string[]; chatbotTips: string[] } | null>(null);
  const loading = item !== null && aiGuide === null;
  const [issuingPickup, setIssuingPickup] = useState(false);
  const [pickupMessage, setPickupMessage] = useState("");
  const existingPass = useMemo(
    () => pickupPasses.find((pass) => pass.lostItemId === itemId && !pass.usedAt) ?? null,
    [pickupPasses, itemId]
  );

  const onIssuePickup = async () => {
    if (!item) return;
    setIssuingPickup(true);
    setPickupMessage("");
    try {
      const lostItemId =
        (item as { lostItemId?: string }).lostItemId &&
        /^\d+$/.test(String((item as { lostItemId?: string }).lostItemId))
          ? String((item as { lostItemId?: string }).lostItemId)
          : /^\d+$/.test(String(item.id))
            ? String(item.id)
            : item.id;
      const result = await issuePickupPass({
        lostItemId,
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
        </div>
        <CardContent className="space-y-4 p-5">
          <Badge>{item.category}</Badge>
          <h1 className="text-2xl font-bold">{item.name}</h1>
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
          {existingPass ? (
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-muted-foreground">발급된 수령 QR</p>
              <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center">
                <PickupQr value={existingPass.token} />
                <div className="space-y-1 text-sm">
                  <p className="text-base font-bold tracking-wider">{existingPass.token}</p>
                  <p className="text-xs text-muted-foreground">
                    유효기간: {new Date(existingPass.expiresAt).toLocaleString("ko-KR", { hour12: false })}
                  </p>
                  <p className="text-xs font-semibold text-primary">관리실에서 QR 확인 대기 중</p>
                </div>
              </div>
            </div>
          ) : (
            <Button onClick={onIssuePickup} disabled={issuingPickup}>
              {issuingPickup ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              내 물건 — 수령 QR 발급받기
            </Button>
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
