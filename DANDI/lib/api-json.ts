import { getAuthSession } from "@/lib/auth-session";
import { getAuthorizationHeaders, getFreshAccessToken } from "@/lib/auth-token";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";

export function getApiBaseUrl() {
  return API_BASE_URL;
}

function apiUrl(path: string) {
  if (!path.startsWith("/")) return `${API_BASE_URL}/${path}`;
  return `${API_BASE_URL}${path}`;
}

export const API_FETCH_TIMEOUT_MS = 45_000;
export const API_MUTATION_TIMEOUT_MS = 30_000;

type ApiFetchOptions = { timeoutMs?: number };

async function apiFetch(
  path: string,
  init?: RequestInit,
  retried = false,
  options?: ApiFetchOptions
): Promise<Response> {
  const authHeader = await getAuthorizationHeaders();
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? API_FETCH_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...authHeader,
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`요청 시간이 초과되었습니다. (${path})`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (
    !retried &&
    (response.status === 401 || response.status === 403) &&
    getAuthSession()?.accessToken
  ) {
    const fresh = await getFreshAccessToken();
    if (fresh) {
      return apiFetch(path, init, true, options);
    }
  }

  return response;
}

export async function apiJson<T>(
  path: string,
  init?: RequestInit,
  options?: ApiFetchOptions
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL 설정이 필요합니다.");
  }

  const response = await apiFetch(path, init, false, options);

  if (!response.ok) {
    let serverMessage = "요청 처리에 실패했습니다.";
    try {
      const err = (await response.json()) as { message?: string; error?: string };
      serverMessage = err.message || err.error || serverMessage;
    } catch {
      try {
        const text = await response.text();
        if (text.trim()) serverMessage = text.trim();
      } catch {
        // ignore
      }
    }
    if (response.status === 404 && serverMessage === "요청 처리에 실패했습니다.") {
      serverMessage = `엔드포인트를 찾을 수 없습니다: ${path}`;
    }
    throw new Error(serverMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export type ReportPatchPayload = {
  itemName?: string;
  category?: string;
  lostAt?: string;
  foundAt?: string;
  location?: string;
  place?: string;
  storage?: string;
  memo?: string;
  itemType?: string;
  image?: string;
  imageUrl?: string;
};

/** 검수 대기 신고 상세 수정 (관리자) — 저장된 신고를 반환 */
export async function patchReportDetails(
  reportId: string,
  payload: ReportPatchPayload,
): Promise<Record<string, unknown>> {
  return apiJson<Record<string, unknown>>(
    `/api/reports/${encodeURIComponent(String(reportId))}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    { timeoutMs: API_MUTATION_TIMEOUT_MS },
  );
}

/** 상태 변경 실패 시 다른 API로 재시도하지 않는다 (상세 PATCH는 status를 반영하지 않음) */
export async function patchReportStatus(reportId: string, status: string): Promise<void> {
  await apiJson<object>(
    `/api/reports/${encodeURIComponent(String(reportId))}/status`,
    { method: "PATCH", body: JSON.stringify({ status }) },
    { timeoutMs: API_MUTATION_TIMEOUT_MS },
  );
}
