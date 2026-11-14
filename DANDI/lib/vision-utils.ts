import { resolveMediaUrl } from "@/lib/media-url";

/** 백엔드 org.example.vision.DocumentType 과 동일 */
export type VisionDocumentType = "NONE" | "ID_CARD" | "STUDENT_ID" | "BANK_CARD";

export type NormalizedVisionResult = {
  id: string;
  documentType: VisionDocumentType;
  ocrApplied: boolean;
  category?: string;
  labels: string[];
  dominantColor: string;
  text?: string;
  /** 등록·홈용 — 백엔드 mosaicImageUrl */
  mosaicImageUrl?: string;
  originalImageUrl?: string;
  createdAt?: string;
};

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

/** UI 체크박스 → 백엔드 documentType */
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
 * - documentType: NONE | ID_CARD | STUDENT_ID | BANK_CARD
 */
export function buildVisionFormData(
  file: File,
  options: { maskId: boolean; maskCard: boolean }
): FormData {
  const formData = new FormData();
  formData.append("image", file, file.name);
  formData.append("documentType", resolveVisionDocumentType(options));
  return formData;
}

/**
 * 백엔드 DTO 기준: mosaicImageUrl (마스킹·모자이크 결과물)
 * originalImageUrl 은 등록에 사용하지 않음
 */
export function pickMosaicImageUrl(data: unknown): string | undefined {
  const raw = asRecord(data);
  const nested = [raw.result, raw.data, raw.payload].map(asRecord);

  const candidates: unknown[] = [
    raw.mosaicImageUrl,
    raw.mosaic_image_url,
    ...nested.flatMap((n) => [n.mosaicImageUrl, n.mosaic_image_url]),
    // 구버전·별칭 (백엔드가 masked* 만 줄 때 대비)
    raw.maskedImageUrl,
    raw.masked_image_url,
    ...nested.flatMap((n) => [n.maskedImageUrl, n.masked_image_url]),
  ];

  for (const value of candidates) {
    if (typeof value !== "string" || !value.trim()) continue;
    const resolved = resolveMediaUrl(value.trim());
    if (resolved) return resolved;
  }
  return undefined;
}

export function pickOriginalImageUrl(data: unknown): string | undefined {
  const raw = asRecord(data);
  const value = raw.originalImageUrl ?? raw.original_image_url;
  if (typeof value !== "string" || !value.trim()) return undefined;
  return resolveMediaUrl(value.trim());
}

export function normalizeVisionResult(data: unknown): NormalizedVisionResult {
  const raw = asRecord(data);
  const id = String(raw.id ?? raw.resultId ?? "");
  const docRaw = String(raw.documentType ?? "NONE").toUpperCase();
  const documentType: VisionDocumentType = ["ID_CARD", "STUDENT_ID", "BANK_CARD", "NONE"].includes(
    docRaw
  )
    ? (docRaw as VisionDocumentType)
    : "NONE";

  return {
    id,
    documentType,
    ocrApplied: Boolean(raw.ocrApplied ?? raw.ocr_applied),
    category: String(raw.category ?? "") || undefined,
    labels: (raw.objectLabels ?? raw.labels ?? []) as string[],
    dominantColor: ((raw.dominantColors as string[] | undefined)?.[0] ?? "-") as string,
    text: String(raw.maskedText ?? raw.text ?? "") || undefined,
    mosaicImageUrl: pickMosaicImageUrl(raw),
    originalImageUrl: pickOriginalImageUrl(raw),
    createdAt: raw.createdAt != null ? String(raw.createdAt) : undefined,
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

/** 분석 직후 등록용 — mosaicImageUrl 만 사용 (originalImageUrl 제외) */
export async function resolveVisionPublishImage(options: {
  apiBaseUrl: string;
  accessToken: string;
  analyzePayload: unknown;
  resultId: string;
  documentType: VisionDocumentType;
  originalDataUrl: string | null;
}): Promise<{ image?: string; notice?: string }> {
  const needsMask = options.documentType !== "NONE";

  const mosaic = pickMosaicImageUrl(options.analyzePayload);

  if (mosaic) {
    return {
      image: mosaic,
      notice: "서버 mosaicImageUrl이 등록·홈 미리보기에 적용되었습니다.",
    };
  }

  if (needsMask) {
    return {
      notice:
        "mosaicImageUrl이 응답에 없습니다. Postman에서 analyze/results JSON에 mosaicImageUrl 포함 여부를 확인해 주세요.",
    };
  }

  return {
    image: options.originalDataUrl ?? undefined,
    notice: "일반 물품 분석입니다. (documentType=NONE)",
  };
}

/**
 * 신분증·카드는 Vision 모자이크를 거친 사진만 공개할 수 있다.
 * 서버(SensitiveImagePolicy)도 같은 규칙으로 거부한다. 화면에서는 요청을 보내기 전에 먼저 경고한다.
 */
export const UNMASKED_SENSITIVE_MESSAGE =
  "신분증·카드 사진은 Vision 모자이크를 적용한 뒤에만 공개할 수 있습니다.\n'수정 (Vision·사진)'에서 Vision 분석으로 모자이크 사진을 만든 뒤 다시 시도해 주세요.";

const SENSITIVE_CATEGORIES = ["신분증", "카드/티켓", "카드"];

export function isSensitiveCategory(category?: string | null): boolean {
  if (!category) return false;
  return category
    .split(",")
    .some((part) => SENSITIVE_CATEGORIES.includes(part.trim()));
}

export function isMosaicImageUrl(url?: string | null): boolean {
  return Boolean(url) && String(url).includes("/vision/mosaic/");
}

/** 신분증·카드인데 사진이 있고 모자이크가 아니면 true */
export function isUnmaskedSensitive(
  category?: string | null,
  image?: string | null,
): boolean {
  return (
    isSensitiveCategory(category) && Boolean(image) && !isMosaicImageUrl(image)
  );
}

/** 서버가 모자이크 미적용으로 공개를 거부했는지 */
export function isUnmaskedRejection(message?: string | null): boolean {
  return Boolean(message) && String(message).includes("모자이크");
}
