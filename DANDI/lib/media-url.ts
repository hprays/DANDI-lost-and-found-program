const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ?? '';

/** 백엔드·AI 예비 이미지 URL — 실제 사진이 아니면 표시하지 않음 */
const PLACEHOLDER_IMAGE_PATTERN =
  /(?:fallback|placeholder|generic|no[_-]?image|default[_-]?image|ai[_-]?preview|dummy|sample)/i;

/**
 * 게시용 실제 사진 URL인지 판별 (없거나 placeholder면 false)
 */
export function isValidItemImageUrl(value: string | undefined | null): boolean {
  if (!value?.trim()) return false;
  const trimmed = value.trim();
  if (trimmed === 'null' || trimmed === 'undefined') return false;
  if (PLACEHOLDER_IMAGE_PATTERN.test(trimmed)) return false;
  const resolved = resolveMediaUrl(trimmed);
  if (!resolved) return false;
  if (PLACEHOLDER_IMAGE_PATTERN.test(resolved)) return false;
  return true;
}

/**
 * 백엔드가 반환하는 상대 경로·다양한 필드명을 브라우저에서 쓸 수 있는 URL로 변환합니다.
 */
export function resolveMediaUrl(
  value: string | undefined | null,
): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return API_BASE_URL ? `${API_BASE_URL}${trimmed}` : trimmed;
  }
  return API_BASE_URL
    ? `${API_BASE_URL}/${trimmed.replace(/^\/+/, '')}`
    : trimmed;
}

/** 목록·상세용 — 유효한 사진만 반환, 없으면 undefined */
export function resolveItemImageUrl(
  value: string | undefined | null,
): string | undefined {
  if (!isValidItemImageUrl(value)) return undefined;
  return resolveMediaUrl(value);
}

/** 화면 표시용 — data URL·업로드 직후 미리보기 포함 (localStorage 백업용) */
export function resolveDisplayImageUrl(
  value: string | undefined | null,
): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith('data:')) return trimmed;
  return resolveItemImageUrl(trimmed);
}

function pickImageValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return resolveMediaUrl(value);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const nested = [
      obj.url,
      obj.path,
      obj.src,
      obj.href,
      obj.fileUrl,
      obj.imageUrl,
    ];
    for (const item of nested) {
      const resolved = pickImageValue(item);
      if (resolved) return resolved;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = pickImageValue(item);
      if (resolved) return resolved;
    }
  }
  return undefined;
}

/** POST/PATCH 시 사진이 없으면 image 필드를 보내지 않음 (백엔드 placeholder 생성 방지) */
export function apiImageFields(image?: string | null): Record<string, string> {
  if (!isValidItemImageUrl(image)) return {};
  const url = resolveMediaUrl(image)!;
  return { image: url, imageUrl: url, photoUrl: url, mosaicImageUrl: url };
}

export function pickImageFromRaw(
  raw: Record<string, unknown>,
): string | undefined {
  const candidates = [
    raw.mosaicImageUrl,
    raw.mosaic_image_url,
    raw.maskedImageUrl,
    raw.masked_image_url,
    raw.image,
    raw.imageUrl,
    raw.imageURL,
    raw.imagePath,
    raw.photoUrl,
    raw.photo,
    raw.thumbnailUrl,
    raw.fileUrl,
    raw.pictureUrl,
    raw.photoPath,
    raw.filePath,
    raw.attachmentUrl,
    raw.attachments,
    raw.images,
    raw.photos,
  ];
  for (const candidate of candidates) {
    const resolved = pickImageValue(candidate);
    if (resolved && isValidItemImageUrl(resolved)) return resolved;
  }
  return undefined;
}
