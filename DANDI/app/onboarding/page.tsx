"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthSession, setAuthSession } from "@/lib/auth-session";
import { saveMyProfile, type UserProfileResponse } from "@/lib/user-profile-api";
import { isValidStudentId, STUDENT_ID_LENGTH, STUDENT_ID_MESSAGE } from "@/lib/student-id";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [studentId, setStudentId] = useState("");
  const [agreed, setAgreed] = useState(false);
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
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setName(session.name ?? "");
      setDepartment(session.department ?? "");
      setStudentId(session.studentId ?? "");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [router]);

  const onSubmit = async () => {
    if (!name.trim() || !department.trim() || !studentId.trim()) {
      setMessage("이름, 학과, 학번을 모두 입력해 주세요.");
      return;
    }
    if (!isValidStudentId(studentId.trim())) {
      setMessage(STUDENT_ID_MESSAGE);
      return;
    }
    if (!agreed) {
      setMessage("개인정보 수집·이용에 동의해 주세요.");
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
    const trimmedStudentId = studentId.trim();

    const persistSession = (saved?: UserProfileResponse) => {
      setAuthSession({
        ...session,
        profileCompleted: saved?.profileCompleted ?? true,
        profileSchemaVersion: 2,
        name: saved?.name ?? trimmedName,
        department: saved?.department ?? trimmedDepartment,
        studentId: saved?.studentId ?? trimmedStudentId,
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
      const saved = await saveMyProfile({
        name: trimmedName,
        department: trimmedDepartment,
        studentId: trimmedStudentId,
      });
      if (getAuthSession()?.email !== session.email) return;
      persistSession(saved);
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
      <Card className="w-full max-w-md" role="region" aria-labelledby="onboarding-title">
        <CardHeader>
          <CardTitle id="onboarding-title" className="text-2xl">프로필 입력</CardTitle>
          <p className="text-sm text-muted-foreground">이름, 학과, 학번을 입력하면 서비스를 시작할 수 있습니다.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">학과</Label>
            <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="소프트웨어학과" disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-id">학번</Label>
            <Input id="student-id" value={studentId} onChange={(e) => setStudentId(e.target.value)}
              inputMode="numeric" maxLength={STUDENT_ID_LENGTH} placeholder="8자리 학번을 입력하세요"
              aria-describedby="student-id-help" disabled={loading} />
            <p id="student-id-help" className="text-xs text-muted-foreground">학번은 직접 입력해 주세요. 수령 시 학생증으로 본인 확인을 진행합니다.</p>
          </div>
          <div className="space-y-2 rounded-xl border bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
            <p className="font-semibold">개인정보 수집·이용 동의 (필수)</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>항목: 학교 이메일, 이름, 학과, 학번, 신고 내용과 사진, 수령 기록</li>
              <li>목적: 분실물 신고·조회, 수령할 때 본인 확인</li>
              <li>보관: 시범 운영 종료(2026년 12월 중순 예정) 후 삭제</li>
              <li>동의하지 않을 수 있지만, 그러면 서비스를 쓸 수 없습니다.</li>
            </ul>
            <Link href="/privacy" target="_blank" className="inline-block font-medium text-primary underline">
              개인정보 처리방침 전문 보기
            </Link>
            <label className="flex items-center gap-2 pt-1 text-sm font-medium text-slate-900">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={loading}
              />
              위 내용에 동의합니다.
            </label>
          </div>
          <Button className="w-full" onClick={onSubmit} disabled={loading || !agreed}>
            {loading ? "저장 중..." : "저장하고 시작하기"}
          </Button>
          {message ? <p role="alert" className="text-sm font-medium text-red-600">{message}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
