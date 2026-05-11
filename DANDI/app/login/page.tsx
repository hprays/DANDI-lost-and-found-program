"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { signInWithPopup } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";
import { setAuthSession } from "@/lib/auth-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";
const AUTH_DEMO_MODE = process.env.NEXT_PUBLIC_AUTH_DEMO_MODE === "true";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const onGoogleLogin = async () => {
    if (!AUTH_DEMO_MODE && !API_BASE_URL) {
      setMessage("NEXT_PUBLIC_API_BASE_URL 설정이 필요합니다.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const credential = await signInWithPopup(firebaseAuth, googleProvider);
      const firebaseIdToken = await credential.user.getIdToken();

      if (AUTH_DEMO_MODE) {
        setAuthSession({
          accessToken: firebaseIdToken,
          profileCompleted: true,
          provider: "firebase-google",
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
      };

      const accessToken = data.accessToken ?? firebaseIdToken;
      const profileCompleted = Boolean(data.profileCompleted);
      setAuthSession({
        accessToken,
        profileCompleted,
        provider: "firebase-google",
      });

      router.replace(profileCompleted ? "/home" : "/onboarding");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google 로그인 중 오류가 발생했습니다.");
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
          <CardDescription>단국대학교 계정으로 안전하게 로그인하세요.</CardDescription>
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
