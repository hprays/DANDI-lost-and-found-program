import { getApiBaseUrl } from "@/lib/api-json";
import { getAuthSession } from "@/lib/auth-session";
import { resolveMediaUrl } from "@/lib/media-url";

function apiUrl(path: string) {
  const base = getApiBaseUrl();
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

export function dataUrlToFile(dataUrl: string, filename = "upload.jpg"): File | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  try {
    const mime = match[1] || "image/jpeg";
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    return new File([bytes], filename.replace(/\.[^.]+$/, "") + `.${ext}`, { type: mime });
  } catch {
    return null;
  }
}

async function apiFormDataPost<T>(path: string, formData: FormData, method = "POST"): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_BASE_URL 설정이 필요합니다.");

  const session = getAuthSession();
  const response = await fetch(apiUrl(path), {
    method,
    headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {},
    body: formData,
  });

  if (!response.ok) {
    let serverMessage = "요청 처리에 실패했습니다.";
    try {
      const err = (await response.json()) as { message?: string; error?: string };
      serverMessage = err.message || err.error || serverMessage;
    } catch {
      const text = await response.text().catch(() => "");
      if (text.trim()) serverMessage = text.trim().slice(0, 300);
    }
    throw new Error(serverMessage);
  }

  const text = await response.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function appendImageToForm(form: FormData, image?: string | null) {
  const trimmed = image?.trim();
  if (!trimmed) return;
  if (trimmed.startsWith("data:")) {
    const file = dataUrlToFile(trimmed);
    if (file) {
      form.append("image", file, file.name);
      form.append("file", file, file.name);
    }
    return;
  }
  const url = resolveMediaUrl(trimmed);
  if (url) {
    form.append("imageUrl", url);
    form.append("image", url);
    form.append("mosaicImageUrl", url);
  }
}

/** 분실물 등록 — 사진은 multipart, URL만 있으면 JSON도 시도 */
export async function postLostItemCreate(
  fields: Record<string, string | undefined>,
  image?: string | null
): Promise<Record<string, unknown>> {
  const paths = ["/api/lost-items", "/api/admin/lost-items"];
  const hasDataImage = Boolean(image?.trim().startsWith("data:"));

  if (hasDataImage) {
    let lastError: Error | null = null;
    for (const path of paths) {
      const form = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        if (value != null && value !== "") form.append(key, value);
      });
      appendImageToForm(form, image);
      try {
        return await apiFormDataPost<Record<string, unknown>>(path, form);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    if (lastError) throw lastError;
  }

  const { apiJson } = await import("@/lib/api-json");
  const body: Record<string, string> = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (value != null && value !== "") body[key] = value;
  });
  const url = image?.trim() ? resolveMediaUrl(image) : undefined;
  if (url) {
    body.image = url;
    body.imageUrl = url;
    body.mosaicImageUrl = url;
  }
  return apiJson<Record<string, unknown>>(paths[0], {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** 신고 등록 — 사진 multipart 우선 */
export async function postReportCreate(
  fields: Record<string, string | undefined>,
  image?: string | null
): Promise<Record<string, unknown>> {
  const path = "/api/reports";
  const hasDataImage = Boolean(image?.trim().startsWith("data:"));

  if (hasDataImage) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value != null && value !== "") form.append(key, value);
    });
    appendImageToForm(form, image);
    return apiFormDataPost<Record<string, unknown>>(path, form);
  }

  const { apiJson } = await import("@/lib/api-json");
  const body: Record<string, string> = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (value != null && value !== "") body[key] = value;
  });
  const url = image?.trim() ? resolveMediaUrl(image) : undefined;
  if (url) {
    body.image = url;
    body.imageUrl = url;
  }
  return apiJson<Record<string, unknown>>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
