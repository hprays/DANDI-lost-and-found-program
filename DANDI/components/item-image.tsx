"use client";

import Image from "next/image";
import {
  BookOpen, CreditCard, CupSoda, Dumbbell, Gem, IdCard, KeyRound, Music, Package,
  Shirt, Smartphone, Sparkles, Umbrella, Wallet, type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { resolveItemImageUrl } from "@/lib/media-url";

type ItemImageProps = {
  src?: string;
  alt: string;
  category?: string;
  sizes?: string;
  fit?: "contain" | "cover";
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "전자기기": Smartphone,
  "지갑/가방": Wallet,
  "신분증": IdCard,
  "카드/티켓": CreditCard,
  "의류": Shirt,
  "악세서리": Gem,
  "도서/문구": BookOpen,
  "스포츠/운동": Dumbbell,
  "악기": Music,
  "텀블러/생활용품": CupSoda,
  "열쇠/키링": KeyRound,
  "우산/우비": Umbrella,
  "화장품": Sparkles,
};

/** 사진이 없거나 로드 실패 시 카테고리 아이콘 표시 (AI 예비 이미지 미사용 — 실물과 혼동 방지) */
export function ItemImage({
  src,
  alt,
  category,
  sizes = "(max-width: 768px) 100vw, 50vw",
  fit = "contain",
}: ItemImageProps) {
  // 실패한 주소를 기억 — src가 바뀌면 자동으로 다시 시도된다 (effect에서 상태를 초기화하지 않음)
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolvedSrc = useMemo(() => resolveItemImageUrl(src), [src]);
  const showImage = Boolean(resolvedSrc && failedSrc !== resolvedSrc);

  if (!showImage) {
    const Icon = (category && CATEGORY_ICONS[category]) || Package;
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400"
        role="img"
        aria-label={`${alt} (사진 없음)`}
      >
        <Icon className="h-14 w-14" strokeWidth={1.5} aria-hidden="true" />
        <span className="text-xs font-medium">사진 없음</span>
      </div>
    );
  }

  const useNativeImg = Boolean(
    resolvedSrc!.startsWith("http://") ||
      resolvedSrc!.startsWith("https://") ||
      resolvedSrc!.startsWith("data:")
  );

  if (useNativeImg) {
    return (
      <div className="relative h-full w-full bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedSrc}
          alt={alt}
          className={`h-full w-full ${fit === "cover" ? "object-cover object-center" : "object-contain object-center"}`}
          onError={() => setFailedSrc(resolvedSrc ?? null)}
        />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-slate-50">
      <Image
        src={resolvedSrc!}
        alt={alt}
        fill
        sizes={sizes}
        className={fit === "cover" ? "object-cover object-center" : "object-contain object-center"}
        onError={() => setFailedSrc(resolvedSrc ?? null)}
        unoptimized={!resolvedSrc!.startsWith("/")}
      />
    </div>
  );
}
