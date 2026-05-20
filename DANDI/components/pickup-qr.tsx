"use client";

type PickupQrProps = {
  value: string;
  size?: number;
};

/** 수령 토큰을 인코딩한 QR 이미지 URL (별도 npm 패키지 불필요) */
function buildQrImageUrl(token: string, size: number): string {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    margin: "6",
    data: token,
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

/**
 * 마이페이지·분실물 상세 수령 QR.
 * qrcode 패키지 없이 표시해 빌드/모듈 오류를 방지합니다.
 */
export function PickupQr({ value, size = 144 }: PickupQrProps) {
  const trimmed = value.trim();

  if (!trimmed) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border bg-slate-50 text-xs text-muted-foreground"
        style={{ width: size, height: size }}
      >
        QR 없음
      </div>
    );
  }

  const qrSrc = buildQrImageUrl(trimmed, size);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrSrc}
        alt={`수령 QR ${trimmed}`}
        width={size}
        height={size}
        className="rounded-lg border bg-white"
        loading="lazy"
        decoding="async"
      />
      <p className="max-w-full break-all text-center font-mono text-[10px] leading-tight text-muted-foreground">
        {trimmed}
      </p>
    </div>
  );
}
