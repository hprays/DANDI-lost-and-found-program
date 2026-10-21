"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { ItemImage } from "@/components/item-image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  catalogReceivedBadgeLabel,
  formatCatalogTimeLine,
} from "@/lib/format-display";
import type { PublishedLostItem } from "@/lib/published-lost-items";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  active,
  onToggle,
  className,
}: {
  active: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "관심 물품에서 빼기" : "관심 물품으로 저장"}
      onClick={(e) => {
        // 카드 링크로 이동하지 않도록 막는다
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow transition hover:scale-105",
        className,
      )}
    >
      <Heart
        className={cn(
          "h-5 w-5",
          active ? "fill-red-500 text-red-500" : "text-slate-500",
        )}
      />
    </button>
  );
}

/** 수령 완료 물품 사진 위 표시 — 사진을 어둡게 덮고 가운데 원형 "수령 완료" */
export function ReceivedOverlay({ large = false }: { large?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55">
      <span
        className={cn(
          "flex flex-col items-center justify-center rounded-full border-2 border-white text-center font-bold leading-tight text-white",
          large ? "h-40 w-40 text-3xl" : "h-28 w-28 text-xl",
        )}
      >
        수령
        <br />
        완료
      </span>
    </div>
  );
}

export function LostItemCard({
  item,
  favorite,
  onToggleFavorite,
}: {
  item: PublishedLostItem;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const receivedBadge = catalogReceivedBadgeLabel(item.catalogStatus);
  return (
    <Link href={`/lost/${item.id}`} className="group block rounded-2xl">
      <Card className="cursor-pointer overflow-hidden transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="relative h-64 overflow-hidden bg-slate-100 md:h-72">
          <ItemImage
            src={item.image}
            alt={item.name}
            category={item.category}
            fit="contain"
          />
          {receivedBadge ? <ReceivedOverlay /> : null}
          <FavoriteButton
            active={favorite}
            onToggle={onToggleFavorite}
            className="absolute right-3 top-3"
          />
        </div>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge className="shrink-0 whitespace-nowrap">{item.category}</Badge>
            <span className="text-right text-xs text-muted-foreground">
              {formatCatalogTimeLine(item)}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-base font-bold">{item.name}</h3>
            {receivedBadge ? (
              <span className="text-lg font-bold leading-tight text-red-600">
                {receivedBadge}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{item.place}</p>
          {item.storage ? (
            <p className="text-xs text-muted-foreground">
              보관: {item.storage}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
