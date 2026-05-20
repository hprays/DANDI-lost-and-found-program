/** QR 스캔: BarcodeDetector(Chrome/Edge) + jsQR(폴백, 동적 로드) */

import { isValidPickupToken, normalizePickupToken } from "@/lib/pickup-token";

export { isValidPickupToken, normalizePickupToken };

type JsQRFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" }
) => { data: string } | null;

let jsQRModule: Promise<JsQRFn | null> | null = null;

async function loadJsQR(): Promise<JsQRFn | null> {
  if (!jsQRModule) {
    jsQRModule = import("jsqr")
      .then((mod) => {
        const fn = (mod as { default?: JsQRFn }).default ?? (mod as unknown as JsQRFn);
        return typeof fn === "function" ? fn : null;
      })
      .catch(() => null);
  }
  return jsQRModule;
}

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

async function decodeWithJsQR(video: HTMLVideoElement): Promise<string | null> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;

  const jsQR = await loadJsQR();
  if (!jsQR) return null;

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
