"use client";

import { getAuthSession, updateAuthSession } from "@/lib/auth-session";
import { firebaseAuth } from "@/lib/firebase-client";

/** Firebase ID 토큰 만료 시 갱신 후 Authorization 헤더 반환 */
export async function getFreshAccessToken(): Promise<string | null> {
  const session = getAuthSession();
  if (!session?.accessToken) return null;

  const user = firebaseAuth.currentUser;
  if (!user) return session.accessToken;

  try {
    const token = await user.getIdToken(true);
    if (token && token !== session.accessToken) {
      updateAuthSession({ accessToken: token });
    }
    return token || session.accessToken;
  } catch {
    return session.accessToken;
  }
}

/** 일반 API — 세션 토큰 사용 (매 요청 강제 갱신 시 지연·타임아웃 유발) */
export async function getAuthorizationHeaders(): Promise<Record<string, string>> {
  const session = getAuthSession();
  const token = session?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
