import { getApiBaseUrl } from '@/lib/api-json';
import { getAuthorizationHeaders } from '@/lib/auth-token';
import { resolveMediaUrl } from '@/lib/media-url';

function apiUrl(path: string) {
  const base = getApiBaseUrl();
  if (!path.startsWith('/')) return `${base}/${path}`;
  return `${base}${path}`;
}

export function dataUrlToFile(
  dataUrl: string,
  filename = 'upload.jpg',
): File | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  try {
    const mime = match[1] || 'image/jpeg';
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const ext = mime.includes('png')
      ? 'png'
      : mime.includes('webp')
        ? 'webp'
        : 'jpg';
    return new File([bytes], filename.replace(/\.[^.]+$/, '') + `.${ext}`, {
      type: mime,
    });
  } catch {
    return null;
  }
}

const UPLOAD_TIMEOUT_MS = 45_000;

async function apiFormDataPost<T>(
  path: string,
  formData: FormData,
  method = 'POST',
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error('NEXT_PUBLIC_API_BASE_URL 설정이 필요합니다.');

  const authHeader = await getAuthorizationHeaders();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers: authHeader,
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`요청 시간이 초과되었습니다. (${path})`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let serverMessage = '요청 처리에 실패했습니다.';
    try {
      const err = (await response.json()) as {
        message?: string;
        error?: string;
      };
      serverMessage = err.message || err.error || serverMessage;
    } catch {
      const text = await response.text().catch(() => '');
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

function appendFormFields(
  form: FormData,
  fields: Record<string, string | undefined>,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = fields[key];
    if (value != null && value !== '') form.append(key, value);
  }
}

function appendImageFile(form: FormData, image?: string | null) {
  const trimmed = image?.trim();
  if (!trimmed?.startsWith('data:')) return;
  const file = dataUrlToFile(trimmed);
  if (file) {
    form.append('image', file, file.name);
    form.append('file', file, file.name);
  }
}

/** DANDI_Backend LostItemController.createMultipart — 프론트 필드명 그대로 + image/file */
const LOST_ITEM_MULTIPART_KEYS = [
  'reportId',
  'name',
  'itemName',
  'category',
  'itemType',
  'location',
  'place',
  'foundLocation',
  'storage',
  'storedLocation',
  'memo',
  'contact',
  'lostAt',
  'foundAt',
  'acquiredAt',
  'createdAt',
  'registeredAt',
  'storedDate',
  'status',
  'color',
  'imageUrl',
  'photoUrl',
  'mosaicImageUrl',
] as const;

function buildLostItemMultipartForm(
  fields: Record<string, string | undefined>,
  image?: string | null,
): FormData {
  const form = new FormData();
  const category = fields.category?.trim();
  const merged: Record<string, string | undefined> = {
    ...fields,
    itemType: fields.itemType?.trim() || category,
  };
  appendFormFields(form, merged, LOST_ITEM_MULTIPART_KEYS);
  appendImageFile(form, image);
  return form;
}

/** DANDI_Backend ReportController.createMultipart */
const REPORT_MULTIPART_KEYS = [
  'itemName',
  'name',
  'category',
  'lostAt',
  'foundAt',
  'location',
  'place',
  'storage',
  'memo',
  'ownerEmail',
  'ownerName',
  'reporterEmail',
  'reporterName',
  'imageUrl',
  'photoUrl',
  'mosaicImageUrl',
] as const;

function buildReportMultipartForm(
  fields: Record<string, string | undefined>,
  image?: string | null,
): FormData {
  const form = new FormData();
  appendFormFields(form, fields, REPORT_MULTIPART_KEYS);
  appendImageFile(form, image);
  return form;
}

/** 분실물 등록 — 사진(data URL)은 multipart, URL만 있으면 JSON */
export async function postLostItemCreate(
  fields: Record<string, string | undefined>,
  image?: string | null,
): Promise<Record<string, unknown>> {
  const path = '/api/lost-items';
  const hasDataImage = Boolean(image?.trim().startsWith('data:'));

  if (hasDataImage) {
    const form = buildLostItemMultipartForm(fields, image);
    return apiFormDataPost<Record<string, unknown>>(path, form);
  }

  const { apiJson } = await import('@/lib/api-json');
  const body: Record<string, string> = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (value != null && value !== '') body[key] = value;
  });
  const url = image?.trim() ? resolveMediaUrl(image) : undefined;
  if (url) {
    body.image = url;
    body.imageUrl = url;
    body.photoUrl = url;
    body.mosaicImageUrl = url;
  }
  return apiJson<Record<string, unknown>>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 신고 등록 — 사진(data URL)은 multipart(S3 업로드), 없으면 JSON */
export async function postReportCreate(
  fields: Record<string, string | undefined>,
  image?: string | null,
): Promise<Record<string, unknown>> {
  const path = '/api/reports';
  const hasDataImage = Boolean(image?.trim().startsWith('data:'));

  if (hasDataImage) {
    const form = buildReportMultipartForm(fields, image);
    return apiFormDataPost<Record<string, unknown>>(path, form);
  }

  const { apiJson } = await import('@/lib/api-json');
  const { apiImageFields } = await import('@/lib/media-url');
  const body: Record<string, string> = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (value != null && value !== '') body[key] = value;
  });
  Object.assign(body, apiImageFields(image));
  return apiJson<Record<string, unknown>>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
