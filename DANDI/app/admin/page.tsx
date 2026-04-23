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
import { Textarea } from "@/components/ui/textarea";
import { useDandiState } from "@/lib/dandi-state";

export default function AdminPage() {
  const {
    reports,
    resolveReport,
    pickupPasses,
    verifyPickupPass,
    adminVerified,
    requestAdminOtp,
    verifyAdminOtp,
    logoutAdmin,
    adminOtpRequestedAt,
    adminAuditLogs,
  } = useDandiState();
  const [adminCode, setAdminCode] = useState("");
  const [otp, setOtp] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [regName, setRegName] = useState("");
  const [regCategory, setRegCategory] = useState("");
  const [regLocation, setRegLocation] = useState("");
  const [regFoundAt, setRegFoundAt] = useState("");
  const [regStorage, setRegStorage] = useState("");
  const [regOtp, setRegOtp] = useState("");
  const [regMemo, setRegMemo] = useState("");
  const [regMessage, setRegMessage] = useState("");
  const [pickupToken, setPickupToken] = useState("");
  const [pickupMessage, setPickupMessage] = useState("");
  const [registeredItems, setRegisteredItems] = useState<
    Array<{ id: string; name: string; category: string; location: string; storage: string; createdAt: string }>
  >([]);

  const pendingReports = useMemo(() => reports.filter((report) => report.status === "pending"), [reports]);
  const processedReports = useMemo(() => reports.filter((report) => report.status !== "pending"), [reports]);

  const requestOtp = () => {
    const result = requestAdminOtp(adminCode);
    setOtpMessage(result.message);
  };

  const verifyOtp = () => {
    const result = verifyAdminOtp(otp);
    setOtpMessage(result.message);
    if (result.ok) {
      setOtp("");
    }
  };

  const registerItem = () => {
    if (!regName.trim() || !regCategory.trim() || !regLocation.trim() || !regFoundAt || !regStorage.trim() || !regOtp.trim()) {
      setRegMessage("물품명, 카테고리, 위치, 습득시간, 보관장소, OTP를 입력해 주세요.");
      return;
    }

    setRegisteredItems((prev) => [
      {
        id: `adm-${Date.now()}`,
        name: regName.trim(),
        category: regCategory.trim(),
        location: regLocation.trim(),
        storage: regStorage.trim(),
        createdAt: new Date().toLocaleString("ko-KR", { hour12: false }),
      },
      ...prev,
    ]);

    setRegName("");
    setRegCategory("");
    setRegLocation("");
    setRegFoundAt("");
    setRegStorage("");
    setRegOtp("");
    setRegMemo("");
    setRegMessage("등록 완료되었습니다.");
  };

  const clearLastRegistered = () => {
    setRegisteredItems((prev) => prev.slice(1));
    setRegMessage("최근 등록 항목을 삭제했습니다.");
  };

  const onVerifyPickup = async () => {
    const result = await verifyPickupPass(pickupToken);
    setPickupMessage(result.message);
    if (result.ok) {
      setPickupToken("");
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
                <p className="text-xs text-muted-foreground">습득/수령 완료</p>
                <p className="mt-1 text-2xl font-bold">
                  {reports.filter((report) => report.status === "resolved" || report.status === "picked_up").length}
                </p>
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

          <Tabs defaultValue="register">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="register">물품 등록</TabsTrigger>
              <TabsTrigger value="pending">검수 대기</TabsTrigger>
              <TabsTrigger value="pickup">수령 인증</TabsTrigger>
              <TabsTrigger value="processed">처리 완료</TabsTrigger>
              <TabsTrigger value="audit">작업 이력</TabsTrigger>
            </TabsList>

            <TabsContent value="register" className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle>관리자 물품 등록</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    등록은 관리자 계정만 가능합니다.
                  </div>

                  <div className="space-y-2">
                    <Label>사진 업로드</Label>
                    <label className="flex h-28 cursor-pointer items-center justify-center rounded-xl border border-dashed text-slate-500 hover:bg-slate-50">
                      클릭하여 사진 업로드
                      <input type="file" accept="image/*" className="hidden" />
                    </label>
                    <p className="text-xs text-muted-foreground">신분증은 사진 없이 텍스트 정보만 기록합니다.</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reg-name">물품명</Label>
                      <Input id="reg-name" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="예: 검은색 반지갑" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-category">카테고리</Label>
                      <Input id="reg-category" value={regCategory} onChange={(e) => setRegCategory(e.target.value)} placeholder="예: 지갑/가방" />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reg-location">습득 위치</Label>
                      <Input id="reg-location" value={regLocation} onChange={(e) => setRegLocation(e.target.value)} placeholder="예: 혜당관 1층" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-found-at">습득 시간</Label>
                      <Input id="reg-found-at" type="datetime-local" value={regFoundAt} onChange={(e) => setRegFoundAt(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-storage">보관 장소</Label>
                    <Input id="reg-storage" value={regStorage} onChange={(e) => setRegStorage(e.target.value)} placeholder="예: 혜당관 학생팀 425호" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-otp">OTP 인증 (장부 기록)</Label>
                    <div className="flex gap-2">
                      <Input id="reg-otp" value={regOtp} onChange={(e) => setRegOtp(e.target.value)} placeholder="6자리 OTP" />
                      <Button variant="outline">인증요청</Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-memo">추가 메모</Label>
                    <Textarea id="reg-memo" value={regMemo} onChange={(e) => setRegMemo(e.target.value)} placeholder="특징/인수인계 메모" />
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <Button onClick={registerItem}>등록 완료</Button>
                    <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={clearLastRegistered}>
                      등록 삭제
                    </Button>
                  </div>
                  {regMessage ? <p className="text-sm font-semibold text-primary">{regMessage}</p> : null}
                </CardContent>
              </Card>

              {registeredItems.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>등록된 물품 목록</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {registeredItems.map((item) => (
                      <div key={item.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-semibold">
                          {item.name} / {item.category}
                        </p>
                        <p className="text-muted-foreground">
                          {item.location} / 보관: {item.storage}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.createdAt}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

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
                      <Button
                        variant="outline"
                        onClick={async () => {
                          const result = await resolveReport(report.id, "resolved");
                          setRegMessage(result.message);
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        습득 완료 처리
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          const result = await resolveReport(report.id, "unavailable");
                          setRegMessage(result.message);
                        }}
                      >
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
                    {report.status === "resolved" ? "습득 완료" : report.status === "picked_up" ? "최종 수령 완료" : "습득 불가"} /{" "}
                    {report.createdAt}
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="pickup" className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle>QR 최종 수령 인증</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={pickupToken}
                      onChange={(e) => setPickupToken(e.target.value)}
                      placeholder="사용자 QR 코드 입력 (예: DKU-123456)"
                    />
                    <Button onClick={onVerifyPickup}>수령 인증 완료</Button>
                  </div>
                  {pickupMessage ? <p className="text-sm font-semibold text-primary">{pickupMessage}</p> : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>발급된 수령 코드</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pickupPasses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">발급된 수령 코드가 없습니다.</p>
                  ) : (
                    pickupPasses.map((pass) => (
                      <div key={pass.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-semibold">{pass.token}</p>
                        <p className="text-muted-foreground">
                          신고 ID: {pass.reportId} / 만료: {new Date(pass.expiresAt).toLocaleString("ko-KR", { hour12: false })}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-primary">
                          {pass.usedAt ? `인증 완료 (${pass.usedAt})` : "미사용"}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
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
