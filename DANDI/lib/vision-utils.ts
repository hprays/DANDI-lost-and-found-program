import { resolveMediaUrl } from "@/lib/media-url";

/** 백엔드 org.example.vision.DocumentType 과 동일 */
export type VisionDocumentType = "NONE" | "ID_CARD" | "STUDENT_ID" | "BANK_CARD";

export type NormalizedVisionResult = {
  id: string;
  category?: string;
  documentType: VisionDocumentType;
  labels: string[];
  dominantColor: string;
  text?: string;
  maskedImageSrc?: string;
};

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

/** UI 체크박스 → 백엔드 documentType (PAYMENT_CARD 등 사용 금지) */
export function resolveVisionDocumentType(options: {
  maskId: boolean;
  maskCard: boolean;
}): VisionDocumentType {
  if (options.maskCard) return "BANK_CARD";
  if (options.maskId) return "ID_CARD";
  return "NONE";
}

export function wantsVisionMask(options: { maskId: boolean; maskCard: boolean }): boolean {
  return resolveVisionDocumentType(options) !== "NONE";
}

/**
 * POST /api/admin/vision/analyze
 * - image (필수)
 * - documentType (필수 권장): NONE | ID_CARD | STUDENT_ID | BANK_CARD
 */
export function buildVisionFormData(
  file: File,
  options: { maskId: boolean; maskCard: boolean }
): FormData {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("documentType", resolveVisionDocumentType(options));
  return formData;
}

/** Vision API 응답에서 마스킹·모자이크 이미지 URL 추출 */
export function pickMaskedImageUrl(data: unknown): string | undefined {
  const raw = asRecord(data);
  const nested = [raw.result, raw.data, raw.payload].map(asRecord);

  const candidates: unknown[] = [
    raw.maskedImageUrl,
    raw.maskedImage,
    raw.masked_image_url,
    raw.masked_image,
    raw.mosaicImageUrl,
    raw.mosaic_image_url,
    raw.blurredImageUrl,
    raw.blurred_image_url,
    raw.outputImageUrl,
    raw.output_image_url,
    raw.processedImageUrl,
    raw.processed_image_url,
    raw.secureImageUrl,
    raw.secure_image_url,
    ...nested.flatMap((n) => [
      n.maskedImageUrl,
      n.maskedImage,
      n.masked_image_url,
      n.mosaicImageUrl,
      n.mosaic_image_url,
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
  const docRaw = String(raw.documentType ?? raw.category ?? "NONE").toUpperCase();
  const documentType: VisionDocumentType = ["ID_CARD", "STUDENT_ID", "BANK_CARD", "NONE"].includes(
    docRaw
  )
    ? (docRaw as VisionDocumentType)
    : "NONE";

  return {
    id,
    category: String(raw.category ?? raw.documentType ?? "") || undefined,
    documentType,
    labels: (raw.objectLabels ?? raw.labels ?? []) as string[],
    dominantColor: ((raw.dominantColors as string[] | undefined)?.[0] ?? "-") as string,
    text: String(raw.maskedText ?? raw.text ?? "") || undefined,
    maskedImageSrc: pickMaskedImageUrl(raw),
  };
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

/** 분석 직후 등록용 이미지 — 서버 모자이크 URL만 사용 (전체 블러 폴백 없음) */
export async function resolveVisionPublishImage(options: {
  apiBaseUrl: string;
  accessToken: string;
  analyzePayload: unknown;
  resultId: string;
  documentType: VisionDocumentType;
  originalDataUrl: string | null;
}): Promise<{ image?: string; notice?: string }> {
  const needsMask = options.documentType !== "NONE";

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
    return {
      image: masked,
      notice: "서버 Vision 마스킹(모자이크) 이미지가 적용되었습니다.",
    };
  }

  if (needsMask) {
    return {
      notice:
        "마스킹 이미지 URL(maskedImageUrl)이 응답에 없습니다. documentType·백엔드 Vision 처리 결과를 확인해 주세요.",
    };
  }

  return {
    image: options.originalDataUrl ?? undefined,
    notice: "일반 물품 분석입니다. (documentType=NONE)",
  };
}
