"use client";

export type AuthSession = {
  accessToken: string;
  profileCompleted: boolean;
  provider?: "firebase-google";
  name?: string;
  email?: string;
  department?: string;
  studentId?: string;
  isAdmin?: boolean;
};

/**
 * NEXT_PUBLIC_ADMIN_EMAILS 환경변수(콤마 구분)에 포함된 이메일만 관리자 권한을 갖는다.
 * 예) NEXT_PUBLIC_ADMIN_EMAILS=admin@dankook.ac.kr,manager@dankook.ac.kr
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  if (!raw.trim()) return false;
  const list = raw
    .split(",")
    .map((it) => it.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

const AUTH_SESSION_KEY = "dandi.auth.session";

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function updateAuthSession(patch: Partial<AuthSession>) {
  const current = getAuthSession();
  if (!current) return;
  setAuthSession({ ...current, ...patch });
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
}

/**
 * dankook.ac.kr 이메일에서 학번(prefix)을 뽑아낸다.
 * 예) dlwjddn5534@dankook.ac.kr -> dlwjddn5534
 */
export function extractStudentIdFromEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const match = email.match(/^([^@]+)@dankook\.ac\.kr$/i);
  return match ? match[1] : undefined;
}

/**
 * 단국대 이메일 여부를 확인한다. (대소문자 무시)
 */
export function isDankookEmail(email?: string | null): boolean {
  if (!email) return false;
  return /@dankook\.ac\.kr$/i.test(email);
}
