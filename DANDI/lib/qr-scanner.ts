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
    const Detector = (window as Window & { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
    const detector = new Detector({ formats: ["qr_code"] });
    const codes = await detector.detect(video);
    const raw = codes[0]?.rawValue?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

export function normalizePickupToken(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  const match = trimmed.match(/DKU-\d{6}/);
  return match ? match[0] : trimmed;
}
