const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "API 요청에 실패했습니다.");
  }

  return response.json() as Promise<T>;
}

export type LostItemDTO = {
  id: number;
  name: string;
  category: string;
  location: string;
  foundAt: string;
};

export async function getLostItems() {
  return request<LostItemDTO[]>("/lost-items");
}

export async function createLostReport(payload: {
  name: string;
  category: string;
  lostAt: string;
  location: string;
  memo?: string;
}) {
  return request<{ id: number }>("/lost-reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
