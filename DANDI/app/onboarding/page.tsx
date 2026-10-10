"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractStudentIdFromEmail, getAuthSession, setAuthSession } from "@/lib/auth-session";
import { apiJson } from "@/lib/api-json";

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

    const session = getAuthSession();
    if (!session?.accessToken) {
      setMessage("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      router.replace("/login");
      return;
    }

    const trimmedName = name.trim();
    const trimmedDepartment = department.trim();
    const studentId = session.studentId ?? extractStudentIdFromEmail(session.email);

    const persistSession = () => {
      setAuthSession({
        ...session,
        profileCompleted: true,
        name: trimmedName,
        department: trimmedDepartment,
        studentId,
      });
    };

    setLoading(true);
    setMessage("");

    if (!API_BASE_URL) {
      persistSession();
      router.replace("/home");
      setLoading(false);
      return;
    }

    try {
      // apiJson은 토큰 만료(401/403) 시 갱신 후 한 번 재시도한다
      await apiJson<object>("/api/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: trimmedName,
          department: trimmedDepartment,
          studentId,
        }),
      });
      persistSession();
      router.replace("/home");
    } catch (error) {
      // 서버에 저장되지 않았으면 완료 처리하지 않는다 — 입력값을 유지한 채 다시 시도하게 한다
      setMessage(
        `프로필 저장에 실패했습니다. (${error instanceof Error ? error.message : "알 수 없는 오류"}) 다시 시도해 주세요.`
      );
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
