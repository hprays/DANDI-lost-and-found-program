import { apiJson } from "@/lib/api-json";
import { getApiBaseUrl } from "@/lib/api-json";

export type UserKeyword = {
  id: string;
  keyword: string;
  createdAt?: string;
};

export async function fetchUserKeywords(): Promise<UserKeyword[]> {
  if (!getApiBaseUrl()) return [];
  const data = await apiJson<UserKeyword[] | { content?: UserKeyword[] }>("/api/users/keywords", {
    method: "GET",
  });
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { content?: UserKeyword[] }).content)) {
    return (data as { content: UserKeyword[] }).content;
  }
  return [];
}

export async function addUserKeyword(keyword: string): Promise<UserKeyword> {
  return apiJson<UserKeyword>("/api/users/keywords", {
    method: "POST",
    body: JSON.stringify({ keyword: keyword.trim() }),
  });
}

export async function deleteUserKeyword(id: string): Promise<void> {
  await apiJson<object>(`/api/users/keywords/${encodeURIComponent(id)}`, { method: "DELETE" });
}
