/** 브라우저 BarcodeDetector로 QR 텍스트 추출 (Chrome/Edge 등) */

type BarcodeDetectorCtor = new (options?: { formats: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

export function isBarcodeDetectorSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export async function decodeQrFromVideo(video: HTMLVideoElement): Promise<string | null> {
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

/** 백엔드 발급 토큰: DKU-123456 또는 DKU-해시(긴 형식) 모두 허용 */
export function normalizePickupToken(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  const longMatch = trimmed.match(/DKU-[A-Z0-9]{10,}/);
  if (longMatch) return longMatch[0];
  const shortMatch = trimmed.match(/DKU-\d{6}/);
  if (shortMatch) return shortMatch[0];
  if (trimmed.startsWith("DKU-")) return trimmed.split(/\s/)[0] ?? trimmed;
  return trimmed;
}

export function isValidPickupToken(token: string): boolean {
  const normalized = normalizePickupToken(token);
  return /^DKU-[A-Z0-9]{6,}$/.test(normalized);
}
