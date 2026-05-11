"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthSession, setAuthSession } from "@/lib/auth-session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const session = getAuthSession();
    if (!session?.accessToken) {
      router.replace("/login");
      return;
    }
    if (session.profileCompleted) {
      router.replace("/home");
    }
  }, [router]);

  const onSubmit = async () => {
    if (!name.trim() || !department.trim()) {
      setMessage("이름과 학과를 입력해 주세요.");
      return;
    }
    if (!API_BASE_URL) {
      setMessage("NEXT_PUBLIC_API_BASE_URL 설정이 필요합니다.");
      return;
    }

    const session = getAuthSession();
    if (!session?.accessToken) {
      setMessage("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      router.replace("/login");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/me/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          department: department.trim(),
        }),
      });

      if (!response.ok) {
        let serverMessage = "프로필 저장에 실패했습니다.";
        try {
          const err = (await response.json()) as { message?: string; error?: string };
          serverMessage = err.message || err.error || serverMessage;
        } catch {
          // ignore parse error
        }
        setMessage(serverMessage);
        return;
      }

      setAuthSession({
        ...session,
        profileCompleted: true,
      });
      router.replace("/home");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "프로필 저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-safe">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">프로필 입력</CardTitle>
          <p className="text-sm text-muted-foreground">최초 1회 이름과 학과를 입력하면 서비스 사용이 가능합니다.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">학과</Label>
            <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="소프트웨어학과" />
          </div>
          <Button className="w-full" onClick={onSubmit} disabled={loading}>
            {loading ? "저장 중..." : "저장하고 시작하기"}
          </Button>
          {message ? <p className="text-sm font-medium text-red-600">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
