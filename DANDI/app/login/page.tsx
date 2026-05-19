"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { signInWithPopup, type AuthError } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";
import {
  extractStudentIdFromEmail,
  isAdminEmail,
  isDankookEmail,
  setAuthSession,
} from "@/lib/auth-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";
const AUTH_DEMO_MODE = process.env.NEXT_PUBLIC_AUTH_DEMO_MODE === "true";

function toKoreanFirebaseError(error: unknown): string {
  const code = (error as AuthError | undefined)?.code;
  switch (code) {
    case "auth/popup-closed-by-user":
      return "로그인 창이 닫혔습니다. 다시 시도해 주세요.";
    case "auth/cancelled-popup-request":
    case "auth/popup-blocked":
      return "팝업이 차단되었습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요.";
    case "auth/network-request-failed":
      return "네트워크 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.";
    case "auth/internal-error":
      return "내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    default:
      if (error instanceof Error) return error.message;
      return "Google 로그인 중 오류가 발생했습니다.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const onGoogleLogin = async () => {
    if (!AUTH_DEMO_MODE && !API_BASE_URL) {
      setMessage("백엔드 주소가 설정되지 않았습니다. 관리자에게 문의해 주세요.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const credential = await signInWithPopup(firebaseAuth, googleProvider);
      const userEmail = credential.user.email ?? undefined;

      // 단국대 이메일 도메인만 허용
      if (!isDankookEmail(userEmail)) {
        try {
          await firebaseAuth.signOut();
        } catch {
          // ignore sign-out error
        }
        setMessage("단국대 이메일(@dankook.ac.kr)만 로그인 가능합니다.");
        return;
      }

      const firebaseIdToken = await credential.user.getIdToken();
      const userName = credential.user.displayName ?? undefined;
      const studentId = extractStudentIdFromEmail(userEmail);
      const adminFlag = isAdminEmail(userEmail);

      if (AUTH_DEMO_MODE) {
        setAuthSession({
          accessToken: firebaseIdToken,
          profileCompleted: true,
          provider: "firebase-google",
          name: userName,
          email: userEmail,
          studentId,
          isAdmin: adminFlag,
        });
        router.replace("/home");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseIdToken}`,
        },
        body: JSON.stringify({ idToken: firebaseIdToken }),
      });

      if (!response.ok) {
        let serverMessage = "로그인 처리에 실패했습니다.";
        try {
          const err = (await response.json()) as { message?: string; error?: string };
          serverMessage = err.message || err.error || serverMessage;
        } catch {
          // ignore parse error
        }
        setMessage(serverMessage);
        return;
      }

      const data = (await response.json()) as {
        accessToken?: string;
        profileCompleted?: boolean;
        department?: string;
        isAdmin?: boolean;
        role?: string;
      };

      const accessToken = data.accessToken ?? firebaseIdToken;
      const profileCompleted = Boolean(data.profileCompleted);
      const backendAdmin = Boolean(data.isAdmin) || data.role === "ADMIN" || data.role === "ROLE_ADMIN";
      setAuthSession({
        accessToken,
        profileCompleted,
        provider: "firebase-google",
        name: userName,
        email: userEmail,
        studentId,
        department: data.department,
        isAdmin: backendAdmin || adminFlag,
      });

      router.replace(profileCompleted ? "/home" : "/onboarding");
    } catch (error) {
      setMessage(toKoreanFirebaseError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-safe">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-3xl">단디 로그인</CardTitle>
          <CardDescription>단국대학교 계정(@dankook.ac.kr)으로 안전하게 로그인하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" onClick={onGoogleLogin} disabled={loading}>
            {loading ? "로그인 진행 중..." : "학교 계정으로 로그인"}
          </Button>
          {AUTH_DEMO_MODE ? (
            <p className="text-center text-xs text-amber-700">임시 데모 모드: 백엔드 로그인 API 없이 홈으로 이동합니다.</p>
          ) : null}
          {message ? <p className="text-center text-sm font-medium text-red-600">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
