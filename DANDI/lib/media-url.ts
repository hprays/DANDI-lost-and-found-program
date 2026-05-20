const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";

/**
 * 백엔드가 반환하는 상대 경로·다양한 필드명을 브라우저에서 쓸 수 있는 URL로 변환합니다.
 */
export function resolveMediaUrl(value: string | undefined | null): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith("data:") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return API_BASE_URL ? `${API_BASE_URL}${trimmed}` : trimmed;
  }
  return API_BASE_URL ? `${API_BASE_URL}/${trimmed.replace(/^\/+/, "")}` : trimmed;
}

function pickImageValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return resolveMediaUrl(value);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const nested = [obj.url, obj.path, obj.src, obj.href, obj.fileUrl, obj.imageUrl];
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

export function pickImageFromRaw(raw: Record<string, unknown>): string | undefined {
  const candidates = [
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
    if (resolved) return resolved;
  }
  return undefined;
}
