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

/** 백엔드는 /api/reports/{id}/status 만 지원 — 상세는 습득 완료 시 lost-items POST로 반영 */
export async function patchReportDetails(
  _reportId: string,
  _payload: ReportPatchPayload,
  _options?: { keepStatus?: string }
): Promise<void> {
  return;
}

export async function patchReportStatus(reportId: string, status: string): Promise<void> {
  const id = encodeURIComponent(String(reportId));
  const body = JSON.stringify({ status });
  const mutationOpts = { timeoutMs: API_MUTATION_TIMEOUT_MS };
  try {
    await apiJson<object>(`/api/reports/${id}/status`, { method: "PATCH", body }, mutationOpts);
    return;
  } catch (firstError) {
    const firstMsg = firstError instanceof Error ? firstError.message : "";
    if (/시간이 초과|timeout|aborted/i.test(firstMsg)) {
      throw firstError instanceof Error ? firstError : new Error("신고 상태 변경에 실패했습니다.");
    }
    try {
      await apiJson<object>(`/api/reports/${id}`, { method: "PATCH", body }, mutationOpts);
      return;
    } catch (secondError) {
      throw secondError instanceof Error ? secondError : new Error("신고 상태 변경에 실패했습니다.");
    }
  }
}
