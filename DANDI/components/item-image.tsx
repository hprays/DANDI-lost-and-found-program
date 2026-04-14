"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { getFallbackImageByCategory } from "@/lib/image-fallback";

type ItemImageProps = {
  src?: string;
  alt: string;
  category?: string;
  sizes?: string;
  fit?: "contain" | "cover";
};

export function ItemImage({ src, alt, category, sizes = "(max-width: 768px) 100vw, 50vw", fit = "contain" }: ItemImageProps) {
  const [failed, setFailed] = useState(false);
  const fallbackSrc = useMemo(() => getFallbackImageByCategory(category), [category]);
  const safeSrc = failed || !src ? fallbackSrc : src;

  return (
    <div className="relative h-full w-full bg-gradient-to-br from-slate-50 to-slate-200">
      <Image
        src={safeSrc}
        alt={alt}
        fill
        sizes={sizes}
        className={fit === "cover" ? "object-cover object-center" : "object-contain object-center"}
        onError={() => setFailed(true)}
        unoptimized={!safeSrc.startsWith("/")}
      />
      {(failed || !src) && (
        <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">AI 예비 이미지</div>
      )}
    </div>
  );
}
