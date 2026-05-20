"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { resolveItemImageUrl } from "@/lib/media-url";

type ItemImageProps = {
  src?: string;
  alt: string;
  category?: string;
  sizes?: string;
  fit?: "contain" | "cover";
};

/** 사진이 없거나 로드 실패 시 단색 빈 영역만 표시 (AI 예비 이미지 미사용) */
export function ItemImage({
  src,
  alt,
  sizes = "(max-width: 768px) 100vw, 50vw",
  fit = "contain",
}: ItemImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = useMemo(() => resolveItemImageUrl(src), [src]);
  const showImage = Boolean(resolvedSrc && !failed);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!showImage) {
    return (
      <div
        className="h-full w-full bg-slate-100"
        role="img"
        aria-label={`${alt} (사진 없음)`}
      />
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
          onError={() => setFailed(true)}
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
        onError={() => setFailed(true)}
        unoptimized={!resolvedSrc!.startsWith("/")}
      />
    </div>
  );
}
