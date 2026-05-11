"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, MapPinned, Megaphone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ItemImage } from "@/components/item-image";
import { QAChatbot } from "@/components/qa-chatbot";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchAIGuidance } from "@/lib/dandi-state";
import { lostItems } from "@/lib/mock-data";
import { applyLostItemAdminChanges, getCustomLostItems } from "@/lib/custom-lost-items";

export default function LostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const itemId = id;
  const [customItems, setCustomItems] = useState(() => getCustomLostItems());
  const item = useMemo(
    () => applyLostItemAdminChanges([...customItems, ...lostItems]).find((it) => it.id === itemId) ?? null,
    [customItems, itemId]
  );
  const itemMemo = (item as { memo?: string } | null)?.memo?.trim() ?? "";
  const [aiGuide, setAiGuide] = useState<{ cautionTitle: string; cautions: string[]; chatbotTips: string[] } | null>(null);
  const loading = item !== null && aiGuide === null;

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setCustomItems(getCustomLostItems());
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

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
            <p>습득 시간: {item.time}</p>
            <p>보관 장소: 혜당관 학생팀 425호</p>
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
