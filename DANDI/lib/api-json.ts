import { getAuthSession } from "@/lib/auth-session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";

export function getApiBaseUrl() {
  return API_BASE_URL;
}

function apiUrl(path: string) {
  if (!path.startsWith("/")) return `${API_BASE_URL}/${path}`;
  return `${API_BASE_URL}${path}`;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL 설정이 필요합니다.");
  }

  const session = getAuthSession();
  const authHeader = session?.accessToken
    ? ({
        Authorization: `Bearer ${session.accessToken}`,
      } as Record<string, string>)
    : {};

  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...authHeader,
      ...(init?.headers ?? {}),
    },
  });

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

function statusPayloadVariants(status: string): string[] {
  const upper = status.toUpperCase();
  const extras =
    status === "resolved"
      ? ["FOUND", "ACQUIRED", "COMPLETED", "APPROVED"]
      : status === "unavailable"
        ? ["NOT_FOUND", "REJECTED", "FAILED"]
        : status === "pending"
          ? ["WAITING", "SUBMITTED", "OPEN"]
          : [];
  return [...new Set([status, upper, ...extras])];
}

export async function patchReportStatus(reportId: string, status: string): Promise<void> {
  const id = encodeURIComponent(String(reportId));
  const attempts: Array<{ method: string; path: string; body?: string }> = [];
  for (const statusValue of statusPayloadVariants(status)) {
    const body = JSON.stringify({ status: statusValue, reportStatus: statusValue });
    attempts.push(
      { method: "PATCH", path: `/api/reports/${id}/status`, body },
      { method: "PUT", path: `/api/reports/${id}/status`, body },
      { method: "PATCH", path: `/api/reports/${id}`, body },
      { method: "PUT", path: `/api/reports/${id}`, body }
    );
  }

  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      await apiJson<object>(attempt.path, { method: attempt.method, body: attempt.body });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("신고 상태 변경에 실패했습니다.");
}
