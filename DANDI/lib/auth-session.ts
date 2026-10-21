"use client";

import { isValidStudentId } from "@/lib/student-id";

export type AuthSession = {
  accessToken: string;
  profileCompleted: boolean;
  provider?: "firebase-google";
  name?: string;
  email?: string;
  department?: string;
  studentId?: string;
  /** v2 student numbers were explicitly entered and saved, never inferred from email. */
  profileSchemaVersion?: 2;
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
    const session = JSON.parse(raw) as AuthSession;
    const hasStudentId = session.profileSchemaVersion === 2 && isValidStudentId(session.studentId);
    return {
      ...session,
      studentId: hasStudentId ? session.studentId : undefined,
      profileCompleted: Boolean(session.profileCompleted && hasStudentId),
    };
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("dandi-auth-changed"));
}

export function updateAuthSession(patch: Partial<AuthSession>) {
  const current = getAuthSession();
  if (!current) return;
  setAuthSession({ ...current, ...patch });
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
  window.dispatchEvent(new CustomEvent("dandi-auth-changed"));
}

/**
 * 단국대 이메일 여부를 확인한다. (대소문자 무시)
 */
export function isDankookEmail(email?: string | null): boolean {
  if (!email) return false;
  return /@dankook\.ac\.kr$/i.test(email);
}
