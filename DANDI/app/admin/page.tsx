"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleX, Clock3, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDandiState } from "@/lib/dandi-state";

export default function AdminPage() {
  const { reports, resolveReport, adminVerified, requestAdminOtp, verifyAdminOtp, logoutAdmin, adminOtpRequestedAt, adminAuditLogs } =
    useDandiState();
  const [adminCode, setAdminCode] = useState("");
  const [otp, setOtp] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  const pendingReports = useMemo(() => reports.filter((report) => report.status === "pending"), [reports]);
  const processedReports = useMemo(() => reports.filter((report) => report.status !== "pending"), [reports]);

  const requestOtp = () => {
    const result = requestAdminOtp(adminCode);
    setOtpMessage(result.message);
    setDemoOtp(result.demoOtp ?? null);
  };

  const verifyOtp = () => {
    const result = verifyAdminOtp(otp);
    setOtpMessage(result.message);
    if (result.ok) {
      setOtp("");
      setDemoOtp(null);
    }
  };

  return (
    <AppShell subtitle="관리자 검수 및 상태 처리">
      {!adminVerified ? (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="h-6 w-6 text-primary" />
              관리자 OTP 인증
            </CardTitle>
            <p className="text-sm text-muted-foreground">등록/검수 기능은 관리자 인증 완료 후에만 사용할 수 있습니다.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">보안 안내</p>
              <p>관리자 인증번호 + OTP 2단계 확인으로 일반 사용자의 관리자 접근을 차단합니다.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-code">관리자 인증번호</Label>
              <div className="flex gap-2">
                <Input
                  id="admin-code"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="예: DKU-ADMIN-2026"
                />
                <Button variant="outline" onClick={requestOtp}>
                  <KeyRound className="h-4 w-4" />
                  OTP 요청
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-otp">OTP 인증(장부 기록)</Label>
              <div className="flex gap-2">
                <Input id="admin-otp" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6자리 OTP 입력" />
                <Button onClick={verifyOtp}>인증 완료</Button>
              </div>
              <p className="text-xs text-muted-foreground">요청 시간: {adminOtpRequestedAt ?? "요청 대기"}</p>
            </div>

            {otpMessage ? <p className="text-sm font-semibold text-primary">{otpMessage}</p> : null}
            {demoOtp ? (
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">개발 테스트 OTP: {demoOtp}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">검수 대기</p>
                <p className="mt-1 text-2xl font-bold">{pendingReports.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">습득 완료</p>
                <p className="mt-1 text-2xl font-bold">{reports.filter((report) => report.status === "resolved").length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">습득 불가</p>
                <p className="mt-1 text-2xl font-bold">{reports.filter((report) => report.status === "unavailable").length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex h-full items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">관리자 세션</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-600">인증 완료</p>
                </div>
                <Button variant="outline" size="sm" onClick={logoutAdmin}>
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </Button>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="pending">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">검수 대기</TabsTrigger>
              <TabsTrigger value="processed">처리 완료</TabsTrigger>
              <TabsTrigger value="audit">작업 이력</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-3">
              {pendingReports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{report.itemName}</p>
                      <Badge>{report.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {report.location} / 접수: {report.createdAt}
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Button variant="outline" onClick={() => resolveReport(report.id, "resolved")}>
                        <CheckCircle2 className="h-4 w-4" />
                        습득 완료 처리
                      </Button>
                      <Button variant="outline" onClick={() => resolveReport(report.id, "unavailable")}>
                        <CircleX className="h-4 w-4" />
                        습득 불가 처리
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="processed" className="space-y-2">
              {processedReports.map((report) => (
                <div key={report.id} className="rounded-xl border bg-white p-3 text-sm">
                  <p className="font-semibold">{report.itemName}</p>
                  <p className="text-muted-foreground">{report.location}</p>
                  <p className="mt-1 text-xs font-semibold text-primary">
                    {report.status === "resolved" ? "습득 완료" : "습득 불가"} / {report.createdAt}
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="audit" className="space-y-2">
              {adminAuditLogs.map((log) => (
                <div key={log.id} className="rounded-xl border bg-white p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    <Clock3 className="h-4 w-4 text-primary" />
                    {log.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{log.createdAt}</p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AppShell>
  );
}
