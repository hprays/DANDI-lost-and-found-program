/** QR 스캔: BarcodeDetector(Chrome/Edge) + jsQR(폴백) */

import jsQR from "jsqr";

type BarcodeDetectorCtor = new (options?: { formats: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

export function isBarcodeDetectorSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export function isQrAutoScanSupported(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

async function decodeWithBarcodeDetector(video: HTMLVideoElement): Promise<string | null> {
  if (!isBarcodeDetectorSupported()) return null;
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;

  try {
    const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
    const detector = new Detector({ formats: ["qr_code"] });
    const codes = await detector.detect(video);
    const raw = codes[0]?.rawValue?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

function decodeWithJsQR(video: HTMLVideoElement): string | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
    return code?.data?.trim() || null;
  } catch {
    return null;
  }
}

/** 비디오 프레임에서 QR 텍스트 추출 */
export async function decodeQrFromVideo(video: HTMLVideoElement): Promise<string | null> {
  const fromNative = await decodeWithBarcodeDetector(video);
  if (fromNative) return fromNative;
  return decodeWithJsQR(video);
}

/** 백엔드 발급 토큰: DKU-123456 또는 DKU-해시(긴 형식), URL 내 token 파라미터 지원 */
export function normalizePickupToken(raw: string): string {
  let trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const fromQuery =
        url.searchParams.get("token") ??
        url.searchParams.get("pickupToken") ??
        url.searchParams.get("code");
      if (fromQuery) trimmed = fromQuery.trim();
    }
  } catch {
    // not a URL
  }

  const upper = trimmed.toUpperCase();
  const longMatch = upper.match(/DKU-[A-Z0-9]{10,}/);
  if (longMatch) return longMatch[0];
  const shortMatch = upper.match(/DKU-\d{6}/);
  if (shortMatch) return shortMatch[0];
  if (upper.startsWith("DKU-")) return upper.split(/\s/)[0]?.replace(/[^A-Z0-9-]/g, "") ?? upper;
  return upper;
}

export function isValidPickupToken(token: string): boolean {
  const normalized = normalizePickupToken(token);
  return /^DKU-[A-Z0-9]{6,}$/.test(normalized);
}
