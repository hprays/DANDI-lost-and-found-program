"use client";

import { useMemo, useState } from "react";
import { resolveMediaUrl } from "@/lib/media-url";

type RemoteImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
};

export function RemoteImage({ src, alt, className = "mx-auto max-h-56 w-full object-contain" }: RemoteImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = useMemo(() => resolveMediaUrl(src ?? undefined), [src]);

  if (!resolved || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolved} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}
