import { resolveMediaUrl } from "@/lib/media-url";

export type VisionResultPayload = {
  id?: string | number;
  resultId?: string | number;
  documentType?: string;
  category?: string;
  objectLabels?: string[];
  labels?: string[];
  dominantColors?: string[];
  maskedText?: string;
  text?: string;
  maskedImageUrl?: string;
  maskedImage?: string;
  blurredImageUrl?: string;
  outputImageUrl?: string;
  processedImageUrl?: string;
  imageUrl?: string;
  image?: string;
  result?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

export type NormalizedVisionResult = {
  id: string;
  category?: string;
  labels: string[];
  dominantColor: string;
  text?: string;
  maskedImageSrc?: string;
};

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

/** Vision API 응답에서 마스킹·블러 처리된 이미지 URL 추출 */
export function pickMaskedImageUrl(data: unknown): string | undefined {
  const raw = asRecord(data);
  const nested = [raw.result, raw.data, raw.payload].map(asRecord);

  const candidates: unknown[] = [
    raw.maskedImageUrl,
    raw.maskedImage,
    raw.masked_image_url,
    raw.masked_image,
    raw.blurredImageUrl,
    raw.blurred_image_url,
    raw.outputImageUrl,
    raw.output_image_url,
    raw.processedImageUrl,
    raw.processed_image_url,
    raw.secureImageUrl,
    raw.secure_image_url,
    raw.imageUrl,
    raw.image,
    raw.photoUrl,
    raw.photo_url,
    ...nested.flatMap((n) => [
      n.maskedImageUrl,
      n.maskedImage,
      n.masked_image_url,
      n.blurredImageUrl,
      n.outputImageUrl,
      n.processedImageUrl,
      n.imageUrl,
      n.image,
    ]),
  ];

  for (const value of candidates) {
    if (typeof value !== "string" || !value.trim()) continue;
    const resolved = resolveMediaUrl(value.trim());
    if (resolved) return resolved;
  }
  return undefined;
}

export function normalizeVisionResult(data: unknown): NormalizedVisionResult {
  const raw = asRecord(data);
  const id = String(raw.id ?? raw.resultId ?? "");
  return {
    id,
    category: String(raw.documentType ?? raw.category ?? "") || undefined,
    labels: (raw.objectLabels ?? raw.labels ?? []) as string[],
    dominantColor: ((raw.dominantColors as string[] | undefined)?.[0] ?? "-") as string,
    text: String(raw.maskedText ?? raw.text ?? "") || undefined,
    maskedImageSrc: pickMaskedImageUrl(raw),
  };
}

export function buildVisionFormData(
  file: File,
  options: { maskId: boolean; maskCard: boolean }
): FormData {
  const formData = new FormData();
  formData.append("image", file);
  if (options.maskId) {
    formData.append("maskIdCard", "true");
    formData.append("documentType", "ID_CARD");
    formData.append("sensitiveContent", "true");
    formData.append("maskSensitive", "true");
  }
  if (options.maskCard) {
    formData.append("maskPaymentCard", "true");
    formData.append("maskCard", "true");
    formData.append("documentType", options.maskId ? "ID_AND_PAYMENT_CARD" : "PAYMENT_CARD");
    formData.append("sensitiveContent", "true");
    formData.append("maskSensitive", "true");
  }
  return formData;
}

/** 서버 마스킹 URL이 없을 때 등록용 클라이언트 블러 (최후 수단) */
export async function blurImageDataUrl(dataUrl: string, blurPx = 14): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas unavailable"));
        return;
      }
      ctx.filter = `blur(${blurPx}px)`;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = dataUrl;
  });
}

export async function fetchVisionResult(
  apiBaseUrl: string,
  accessToken: string,
  resultId: string
): Promise<unknown> {
  const response = await fetch(
    `${apiBaseUrl}/api/admin/vision/results/${encodeURIComponent(resultId.trim())}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!response.ok) {
    let message = "분석 결과 조회에 실패했습니다.";
    try {
      const err = (await response.json()) as { message?: string; error?: string };
      message = err.message || err.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return response.json();
}

/** 분석 직후·조회 시 등록/미리보기에 쓸 이미지 URL (마스킹 우선) */
export async function resolveVisionPublishImage(options: {
  apiBaseUrl: string;
  accessToken: string;
  analyzePayload: unknown;
  resultId: string;
  wantsMask: boolean;
  originalDataUrl: string | null;
}): Promise<{ image?: string; notice?: string }> {
  let masked = pickMaskedImageUrl(options.analyzePayload);

  if (!masked && options.resultId) {
    try {
      const detail = await fetchVisionResult(options.apiBaseUrl, options.accessToken, options.resultId);
      masked = pickMaskedImageUrl(detail);
    } catch {
      // analyze 응답만으로 진행
    }
  }

  if (masked) {
    return { image: masked, notice: "마스킹된 이미지가 적용되었습니다." };
  }

  if (options.wantsMask && options.originalDataUrl) {
    try {
      const blurred = await blurImageDataUrl(options.originalDataUrl);
      return {
        image: blurred,
        notice: "서버 마스킹 URL이 없어 블러 처리한 이미지로 등록합니다. (백엔드 maskedImageUrl 확인 권장)",
      };
    } catch {
      return {
        notice: "민감정보 마스킹 이미지를 받지 못했습니다. Vision API maskedImageUrl 응답을 확인해 주세요.",
      };
    }
  }

  if (options.wantsMask) {
    return { notice: "민감정보 마스킹 이미지를 받지 못했습니다." };
  }

  return { image: options.originalDataUrl ?? undefined };
}
