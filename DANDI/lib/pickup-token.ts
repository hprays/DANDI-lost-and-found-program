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
