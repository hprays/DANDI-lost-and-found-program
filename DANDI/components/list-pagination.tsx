"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type ListPaginationProps = {
  label: string;
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
};

export function ListPagination({ label, page, totalPages, total, start, end, onPageChange }: ListPaginationProps) {
  if (!total) return null;

  return (
    <nav aria-label={`${label} 페이지`} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
      <p className="text-xs text-muted-foreground">전체 {total}개 중 {start}–{end}개</p>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" aria-label={`${label} 이전 페이지`}
          disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />이전
        </Button>
        <span aria-live="polite" aria-atomic="true" className="min-w-20 text-center text-xs font-medium tabular-nums">
          {page} / {totalPages} 페이지
        </span>
        <Button type="button" size="sm" variant="outline" aria-label={`${label} 다음 페이지`}
          disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          다음<ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
