"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function isDankookEmail(value: string) {
  return /^[^\s@]+@dankook\.ac\.kr$/i.test(value);
}

export default function LoginPage() {
  const [signupEmail, setSignupEmail] = useState("");
  const [signupTouched, setSignupTouched] = useState(false);

  const emailValid = useMemo(() => isDankookEmail(signupEmail), [signupEmail]);
  const showError = signupTouched && signupEmail.length > 0 && !emailValid;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-safe">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-3xl">단디 로그인</CardTitle>
          <CardDescription>단국대학교 이메일 기반 분실물 서비스</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">로그인</TabsTrigger>
              <TabsTrigger value="signup">회원가입</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">학교 이메일</Label>
                  <Input id="login-email" type="email" placeholder="example@dankook.ac.kr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">비밀번호</Label>
                  <Input id="login-password" type="password" placeholder="비밀번호 입력" />
                </div>
                <div className="text-right">
                  <Button variant="ghost" size="sm" type="button" className="px-0 text-primary">
                    비밀번호 찾기
                  </Button>
                </div>
                <Button asChild className="w-full">
                  <Link href="/home">로그인</Link>
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input id="name" placeholder="홍길동" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student-no">학번</Label>
                  <Input id="student-no" placeholder="예: 32191234" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">학교 이메일</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onBlur={() => setSignupTouched(true)}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="example@dankook.ac.kr"
                    className={showError ? "border-red-500 focus-visible:ring-red-400" : ""}
                  />
                  {showError ? (
                    <p className="text-sm font-medium text-red-600">@dankook.ac.kr 도메인 이메일만 사용할 수 있습니다.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">단국대 학생 이메일 인증 후 가입됩니다.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">비밀번호</Label>
                  <Input id="signup-password" type="password" placeholder="8자 이상 입력" />
                </div>
                <Button type="button" className="w-full" disabled={!emailValid}>
                  회원가입
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
