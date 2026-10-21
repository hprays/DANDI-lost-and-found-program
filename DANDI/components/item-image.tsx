"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { itemPlaceholderImage } from "@/lib/item-category";
import { resolveItemImageUrl } from "@/lib/media-url";

type ItemImageProps = {
  src?: string;
  alt: string;
  category?: string;
  sizes?: string;
  fit?: "contain" | "cover";
};

/** 사진이 없거나 로드 실패 시 물품명에 맞는 일러스트 + "사진 없음" 표시 */
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
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-50"
        role="img"
        aria-label={`${alt} (사진 없음)`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={itemPlaceholderImage(alt, category)} alt="" className="h-1/2 max-h-36 w-auto" />
        <span className="text-xs font-medium text-slate-400">사진 없음</span>
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
