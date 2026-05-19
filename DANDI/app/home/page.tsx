"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CirclePlus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ItemImage } from "@/components/item-image";
import { QAChatbot } from "@/components/qa-chatbot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildings, categories, lostItems } from "@/lib/mock-data";
import { applyLostItemAdminChanges, type CustomLostItem, getCustomLostItems } from "@/lib/custom-lost-items";

export default function HomePage() {
  const [customItems] = useState<CustomLostItem[]>(() => getCustomLostItems());
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("전체");
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  const mergedItems = useMemo(() => applyLostItemAdminChanges([...customItems, ...lostItems]), [customItems]);

  const filteredItems = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    return mergedItems.filter((item) => {
      const categoryOk = selectedCategory === "전체" || item.category === selectedCategory;
      const buildingOk =
        selectedBuilding === "전체" ||
        (item.place ?? "").toLowerCase().includes(selectedBuilding.toLowerCase());
      const keywordOk =
        keyword.length === 0 ||
        [item.name, item.category, item.type, item.place, (item as { memo?: string }).memo]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      return categoryOk && buildingOk && keywordOk;
    });
  }, [mergedItems, selectedCategory, selectedBuilding, searchKeyword]);

  return (
    <AppShell subtitle="분실물 현황을 실시간으로 확인해보세요.">
      <section className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">물건을 잃어버리셨나요?</p>
                <p className="text-lg font-bold">관리자에게 신고 접수</p>
              </div>
              <Button asChild>
                <Link href="/register-item">
                  <CirclePlus className="h-4 w-4" />
                  신고하기
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">주인을 찾아주세요</p>
                <p className="text-lg font-bold">주변 관리실 위치 안내</p>
              </div>
              <Button asChild variant="outline">
                <Link href="/map">지도 보기</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="분실물 키워드 검색 (예: 에어팟, 검정 지갑)"
              className="pl-9"
            />
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">카테고리 분류</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className="cursor-pointer whitespace-nowrap px-3 py-1"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">건물별 분류</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {buildings.map((building) => (
                <Badge
                  key={building}
                  variant={selectedBuilding === building ? "default" : "secondary"}
                  className="cursor-pointer whitespace-nowrap px-3 py-1"
                  onClick={() => setSelectedBuilding(building)}
                >
                  {building}
                </Badge>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              총 <b className="text-foreground">{filteredItems.length}</b>건
              {selectedCategory !== "전체" || selectedBuilding !== "전체" || searchKeyword ? (
                <button
                  type="button"
                  className="ml-2 rounded-md border px-2 py-0.5 text-[11px] hover:bg-slate-50"
                  onClick={() => {
                    setSelectedCategory("전체");
                    setSelectedBuilding("전체");
                    setSearchKeyword("");
                  }}
                >
                  필터 초기화
                </button>
              ) : null}
            </span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {filteredItems.length === 0 ? (
            <div className="md:col-span-2 rounded-xl border bg-white p-6 text-center text-sm text-muted-foreground">
              조건에 맞는 분실물이 없습니다. 필터를 조정하거나 키워드를 다시 입력해 보세요.
            </div>
          ) : null}
          {filteredItems.map((item) => (
            <Link key={item.id} href={`/lost/${item.id}`}>
              <Card className="cursor-pointer overflow-hidden transition-transform hover:-translate-y-0.5">
                <div className="relative h-64 overflow-hidden bg-slate-100 md:h-72">
                  <ItemImage src={item.image} alt={item.name} category={item.category} fit="contain" />
                </div>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <Badge>{item.category}</Badge>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </div>
                  <h3 className="text-base font-bold">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.place}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <QAChatbot />
    </AppShell>
  );
}
