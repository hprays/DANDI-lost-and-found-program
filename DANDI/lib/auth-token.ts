"use client";

import { clearAuthSession, getAuthSession, updateAuthSession } from "@/lib/auth-session";
import { firebaseAuth } from "@/lib/firebase-client";
import { safeRemoveLocalStorage } from "@/lib/safe-local-storage";

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

/**
 * 모든 API 요청(JSON·multipart) 공통 헤더.
 * getIdToken()은 강제 갱신이 아니라 만료가 가까울 때만 새로 받으므로 오래 켜 둔 화면에서도 유효한 토큰을 쓴다.
 * Firebase 사용자가 아직 복원되지 않았으면 저장된 세션 토큰을 쓴다.
 */
export async function getAuthorizationHeaders(): Promise<Record<string, string>> {
  const session = getAuthSession();
  if (!session?.accessToken) return {};
  let token = session.accessToken;
  const user = firebaseAuth.currentUser;
  if (user) {
    try {
      const current = await user.getIdToken();
      if (current && current !== token) {
        updateAuthSession({ accessToken: current });
        token = current;
      }
    } catch {
      // 네트워크 오류 등 — 저장된 토큰으로 시도하고 401이면 호출 측이 재시도한다
    }
  }
  return { Authorization: `Bearer ${token}` };
}

/** 계정별 개인 데이터 키 접두사 (로그아웃 시 삭제). 물품 카탈로그 캐시는 공용이라 남긴다. */
const PERSONAL_STORAGE_PREFIXES = [
  "dandi.reports.local",
  "dandi.pickupPasses",
  "dandi.userPrefs.",
];

/** Firebase 로그아웃 + 앱 세션·개인 캐시 정리. dandi-auth-changed 이벤트로 화면 상태도 초기화된다. */
export async function logout(): Promise<void> {
  if (typeof window !== "undefined") {
    Object.keys(window.localStorage)
      .filter((key) => PERSONAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .forEach(safeRemoveLocalStorage);
  }
  try {
    await firebaseAuth.signOut();
  } catch {
    // Firebase 세션이 이미 없으면 무시
  }
  clearAuthSession();
}
