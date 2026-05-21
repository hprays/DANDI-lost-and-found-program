"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { ChevronLeft, ChevronRight, CirclePlus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ItemImage } from "@/components/item-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { applyLostItemAdminChanges } from "@/lib/custom-lost-items";
import { useDandiState } from "@/lib/dandi-state";
import { formatCatalogTimeLine } from "@/lib/format-display";
import { buildings, categories, lostItems } from "@/lib/mock-data";

const ITEMS_PER_PAGE = 8;
const USE_MOCK_LOST_ITEMS = process.env.NEXT_PUBLIC_ENABLE_MOCK_LOST_ITEMS === "true";

function getVisiblePages(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | "ellipsis"> = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export default function HomePage() {
  const { homeLostItems, catalogLoading, refreshHomeCatalog } = useDandiState();
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("전체");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    void refreshHomeCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 홈 진입 시 1회만 목록 로드
  }, []);

  const mergedItems = useMemo(() => {
    const published = applyLostItemAdminChanges(homeLostItems);
    if (!USE_MOCK_LOST_ITEMS) return published;
    return applyLostItemAdminChanges([...published, ...lostItems]);
  }, [homeLostItems]);

  const filteredItems = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    return mergedItems.filter((item) => {
      const categoryOk = selectedCategory === "전체" || item.category === selectedCategory;
      const buildingOk =
        selectedBuilding === "전체" ||
        (item.place ?? "").toLowerCase().includes(selectedBuilding.toLowerCase()) ||
        (item.storage ?? "").toLowerCase().includes(selectedBuilding.toLowerCase());
      const keywordOk =
        keyword.length === 0 ||
        [item.name, item.category, item.type, item.place, item.storage, (item as { memo?: string }).memo]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      return categoryOk && buildingOk && keywordOk;
    });
  }, [mergedItems, selectedCategory, selectedBuilding, searchKeyword]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, safePage]);

  const visiblePages = useMemo(() => getVisiblePages(safePage, totalPages), [safePage, totalPages]);

  const resetFilters = () => {
    setSelectedCategory("전체");
    setSelectedBuilding("전체");
    setSearchKeyword("");
    setCurrentPage(1);
  };

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
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setCurrentPage(1);
              }}
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
                  onClick={() => {
                    setSelectedCategory(category);
                    setCurrentPage(1);
                  }}
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
                  onClick={() => {
                    setSelectedBuilding(building);
                    setCurrentPage(1);
                  }}
                >
                  {building}
                </Badge>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              총 <b className="text-foreground">{filteredItems.length}</b>건
              {filteredItems.length > 0 ? (
                <span className="ml-1">
                  · {safePage}/{totalPages}페이지
                </span>
              ) : null}
              {selectedCategory !== "전체" || selectedBuilding !== "전체" || searchKeyword ? (
                <button
                  type="button"
                  className="ml-2 rounded-md border px-2 py-0.5 text-[11px] hover:bg-slate-50"
                  onClick={resetFilters}
                >
                  필터 초기화
                </button>
              ) : null}
            </span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {catalogLoading ? (
            <div className="md:col-span-2 flex items-center justify-center gap-2 rounded-xl border bg-white p-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              분실물 목록을 불러오는 중…
            </div>
          ) : null}
          {!catalogLoading && filteredItems.length === 0 ? (
            <div className="md:col-span-2 rounded-xl border bg-white p-6 text-center text-sm text-muted-foreground">
              습득 완료 처리된 분실물만 표시됩니다. 관리자 검수 후 목록에 노출됩니다.
            </div>
          ) : null}
          {!catalogLoading
            ? paginatedItems.map((item) => {
            const timeLabel = formatCatalogTimeLine(item);
            return (
            <Link key={item.id} href={`/lost/${item.id}`}>
              <Card className="cursor-pointer overflow-hidden transition-transform hover:-translate-y-0.5">
                <div className="relative h-64 overflow-hidden bg-slate-100 md:h-72">
                  <ItemImage src={item.image} alt={item.name} category={item.category} fit="contain" />
                </div>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge>{item.category}</Badge>
                    <span className="text-right text-xs text-muted-foreground">{timeLabel}</span>
                  </div>
                  <h3 className="text-base font-bold">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.place}</p>
                  {item.storage ? <p className="text-xs text-muted-foreground">보관: {item.storage}</p> : null}
                </CardContent>
              </Card>
            </Link>
            );
              })
            : null}
        </div>

        {filteredItems.length > 0 && totalPages > 1 ? (
          <nav
            className="flex flex-wrap items-center justify-center gap-1 rounded-2xl border bg-white px-3 py-3 shadow-sm"
            aria-label="분실물 목록 페이지"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="이전 페이지"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {visiblePages.map((page, idx) =>
              page === "ellipsis" ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-sm text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={page}
                  type="button"
                  variant={page === safePage ? "default" : "outline"}
                  size="sm"
                  className="h-8 min-w-8 px-2"
                  onClick={() => setCurrentPage(page)}
                  aria-label={`${page}페이지`}
                  aria-current={page === safePage ? "page" : undefined}
                >
                  {page}
                </Button>
              )
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="다음 페이지"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>
        ) : null}
      </section>
    </AppShell>
  );
}
