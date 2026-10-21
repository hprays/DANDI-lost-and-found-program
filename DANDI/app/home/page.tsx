"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { ChevronLeft, ChevronRight, CirclePlus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LostItemCard } from "@/components/lost-item-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFavorites } from "@/lib/favorites";
import { catalogReceivedBadgeLabel, parseDateTimeMs } from "@/lib/format-display";
import {
  PERIOD_FILTERS,
  STATUS_FILTERS,
  periodStartMs,
  type PeriodFilter,
  type StatusFilter,
} from "@/lib/item-filters";
import { buildings, categories } from "@/lib/mock-data";
import { useNow } from "@/lib/pickup-pass-state";
import { cn } from "@/lib/utils";
import { itemSearchText, useCatalogItems } from "@/lib/use-catalog-items";

const ITEMS_PER_PAGE = 8;

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

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("space-y-2", className)}>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={cn(
                "h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-slate-700 hover:border-primary/40 hover:bg-accent",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { items: mergedItems, catalogLoading, catalogError, refreshHomeCatalog } = useCatalogItems();
  const favorites = useFavorites();
  const now = useNow(60_000);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>("전체");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("전체");
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("전체");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredItems = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    const periodStart = periodStartMs(selectedPeriod, now);
    return mergedItems.filter((item) => {
      // 습득 일시 기준, 없으면 등록 일시 — 날짜를 모르는 물품은 기간 필터에서 제외
      const periodOk =
        periodStart === 0 || parseDateTimeMs(item.foundAt ?? item.createdAt ?? item.time) >= periodStart;
      const received = catalogReceivedBadgeLabel(item.catalogStatus) !== null;
      const statusOk =
        selectedStatus === "전체" || (selectedStatus === "수령 완료" ? received : !received);
      const categoryOk = selectedCategory === "전체" || item.category === selectedCategory;
      const buildingOk =
        selectedBuilding === "전체" ||
        (item.place ?? "").toLowerCase().includes(selectedBuilding.toLowerCase()) ||
        (item.storage ?? "").toLowerCase().includes(selectedBuilding.toLowerCase());
      const keywordOk = keyword.length === 0 || itemSearchText(item).includes(keyword);
      return periodOk && statusOk && categoryOk && buildingOk && keywordOk;
    });
  }, [mergedItems, now, selectedPeriod, selectedStatus, selectedCategory, selectedBuilding, searchKeyword]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, safePage]);

  const visiblePages = useMemo(() => getVisiblePages(safePage, totalPages), [safePage, totalPages]);

  const resetFilters = () => {
    setSelectedPeriod("전체");
    setSelectedStatus("전체");
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

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <ChipGroup
              label="습득 기간"
              options={PERIOD_FILTERS}
              value={selectedPeriod}
              onChange={(period) => {
                setSelectedPeriod(period);
                setCurrentPage(1);
              }}
            />
            <ChipGroup
              label="수령 상태"
              options={STATUS_FILTERS}
              value={selectedStatus}
              onChange={(status) => {
                setSelectedStatus(status);
                setCurrentPage(1);
              }}
            />
          </div>

          <ChipGroup
            className="mt-4"
            label="카테고리 분류"
            options={categories}
            value={selectedCategory}
            onChange={(category) => {
              setSelectedCategory(category);
              setCurrentPage(1);
            }}
          />

          <ChipGroup
            className="mt-4"
            label="건물별 분류"
            options={buildings}
            value={selectedBuilding}
            onChange={(building) => {
              setSelectedBuilding(building);
              setCurrentPage(1);
            }}
          />

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              총 <b className="text-foreground">{filteredItems.length}</b>건
              {filteredItems.length > 0 ? (
                <span className="ml-1">
                  · {safePage}/{totalPages}페이지
                </span>
              ) : null}
              {selectedPeriod !== "전체" ||
              selectedStatus !== "전체" ||
              selectedCategory !== "전체" ||
              selectedBuilding !== "전체" || searchKeyword ? (
                <button
                  type="button"
                  className="ml-2 cursor-pointer rounded-md border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent"
                  onClick={resetFilters}
                >
                  필터 초기화
                </button>
              ) : null}
            </span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {catalogLoading && mergedItems.length === 0 ? (
            <div className="md:col-span-2 flex items-center justify-center gap-2 rounded-xl border bg-white p-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              분실물 목록을 불러오는 중…
            </div>
          ) : null}
          {catalogError ? (
            <div
              role="alert"
              className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
            >
              <span>
                {catalogError}
                {mergedItems.length > 0 ? " 아래는 이전에 불러온 목록입니다." : ""}
              </span>
              <Button size="sm" variant="outline" onClick={() => void refreshHomeCatalog()} disabled={catalogLoading}>
                다시 시도
              </Button>
            </div>
          ) : null}
          {filteredItems.length === 0 && !catalogLoading && !catalogError ? (
            <div className="md:col-span-2 rounded-xl border bg-white p-6 text-center text-sm text-muted-foreground">
              {mergedItems.length === 0
                ? "등록된 분실물이 없습니다. 습득 완료 처리된 분실물만 표시됩니다."
                : "조건에 맞는 분실물이 없습니다."}
            </div>
          ) : null}
          {filteredItems.length > 0
            ? paginatedItems.map((item) => (
                <LostItemCard
                  key={item.id}
                  item={item}
                  favorite={favorites.isFavorite(String(item.id))}
                  onToggleFavorite={() => favorites.toggle(String(item.id))}
                />
              ))
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
