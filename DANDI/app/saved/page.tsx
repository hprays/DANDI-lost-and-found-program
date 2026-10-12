"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LostItemCard } from "@/components/lost-item-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiBaseUrl } from "@/lib/api-json";
import { useFavorites } from "@/lib/favorites";
import type { PublishedLostItem } from "@/lib/published-lost-items";
import { itemSearchText, useCatalogItems } from "@/lib/use-catalog-items";
import { fetchUserKeywords } from "@/lib/user-keywords-api";
import { getStoredKeywords, setStoredKeywords } from "@/lib/user-preferences";

export default function SavedPage() {
  const { items, catalogLoading } = useCatalogItems();
  const favorites = useFavorites();
  const [keywords, setKeywords] = useState<string[]>([]);

  // 마이페이지와 같은 순서: 서버 키워드 우선, 실패하면 로컬 캐시
  useEffect(() => {
    let cancelled = false;
    const rafId = window.requestAnimationFrame(() => setKeywords(getStoredKeywords()));
    if (getApiBaseUrl()) {
      fetchUserKeywords()
        .then((rows) => {
          if (cancelled) return;
          const next = rows.map((r) => r.keyword);
          setKeywords(next);
          setStoredKeywords(next, { silent: true });
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  const favoriteItems = useMemo(
    () => items.filter((item) => favorites.ids.includes(String(item.id))),
    [items, favorites.ids]
  );

  const keywordItems = useMemo(() => {
    const needles = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (needles.length === 0) return [];
    return items.filter((item) => {
      const text = itemSearchText(item);
      return needles.some((k) => text.includes(k));
    });
  }, [items, keywords]);

  const renderList = (list: PublishedLostItem[], empty: React.ReactNode) => {
    if (catalogLoading && items.length === 0) {
      return (
        <div className="flex items-center justify-center gap-2 rounded-xl border bg-white p-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          분실물 목록을 불러오는 중…
        </div>
      );
    }
    if (list.length === 0) {
      return <div className="rounded-xl border bg-white p-6 text-center text-sm text-muted-foreground">{empty}</div>;
    }
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((item) => (
          <LostItemCard
            key={item.id}
            item={item}
            favorite={favorites.isFavorite(String(item.id))}
            onToggleFavorite={() => favorites.toggle(String(item.id))}
          />
        ))}
      </div>
    );
  };

  return (
    <AppShell subtitle="저장한 물품과 키워드에 맞는 물품을 모아 봅니다.">
      <Tabs defaultValue="favorites" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="favorites">관심 물품 ({favoriteItems.length})</TabsTrigger>
          <TabsTrigger value="keywords">키워드 일치 ({keywordItems.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="favorites">
          {renderList(favoriteItems, "물품 카드의 하트를 누르면 여기에 저장됩니다. (이 기기에만 저장)")}
        </TabsContent>

        <TabsContent value="keywords" className="space-y-3">
          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map((k) => (
                <Badge key={k} variant="secondary">
                  #{k}
                </Badge>
              ))}
            </div>
          ) : null}
          {renderList(
            keywordItems,
            keywords.length === 0 ? (
              <>
                등록한 알림 키워드가 없습니다.{" "}
                <Link href="/mypage" className="font-semibold text-primary underline">
                  마이페이지에서 키워드 등록
                </Link>
              </>
            ) : (
              "키워드에 맞는 물품이 아직 없습니다."
            )
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
