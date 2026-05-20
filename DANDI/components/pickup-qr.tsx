"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

type PickupQrProps = {
  value: string;
  size?: number;
};

/** 마이페이지·수령 안내용 — 토큰 문자열이 그대로 인코딩되는 표준 QR */
export function PickupQr({ value, size = 144 }: PickupQrProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value.trim()) return;
    void QRCode.toCanvas(canvas, value.trim(), {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    }).catch(() => undefined);
  }, [value, size]);

  if (!value.trim()) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border bg-slate-50 text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        QR 없음
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-lg border bg-white"
      aria-label={`수령 QR ${value}`}
    />
  );
}
