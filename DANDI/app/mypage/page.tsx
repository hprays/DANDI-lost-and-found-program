"use client";

import { useState } from "react";
import { BellRing, Plus, X } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { AppShell } from "@/components/app-shell";
import { PickupQr } from "@/components/pickup-qr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDandiState } from "@/lib/dandi-state";

export default function MyPage() {
  const { notices, reports, pickupPasses, issuePickupPass, markNoticeRead } = useDandiState();
  const [keyword, setKeyword] = useState("");
  const [tags, setTags] = useState<string[]>(["에어팟", "검정", "지갑"]);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [pickupMessage, setPickupMessage] = useState("");

  const addTag = () => {
    const trimmed = keyword.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
    setKeyword("");
  };

  const issueQr = async (reportId: string) => {
    const result = await issuePickupPass(reportId);
    setPickupMessage(result.message);
  };

  return (
    <AppShell subtitle="내 정보와 알림 설정을 관리하세요.">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>내 계정</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input defaultValue="홍길동" />
            </div>
            <div className="space-y-2">
              <Label>학교 이메일</Label>
              <Input defaultValue="example@dankook.ac.kr" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>관심 키워드 알림 설정</CardTitle>
            <p className="text-sm text-muted-foreground">
              내가 등록한 키워드와 일치하는 전체 분실물(내 신고 포함)이 올라오면 알림을 받습니다.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="예: 주황색 텀블러, 에어팟" />
              <Button size="icon" onClick={addTag} aria-label="태그 추가">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                  {tag}
                  <button type="button" onClick={() => setTags((prev) => prev.filter((it) => it !== tag))} aria-label={`${tag} 삭제`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <p className="text-sm font-medium">매칭 알림 받기 (키워드 기준)</p>
              <Switch checked={alertEnabled} onCheckedChange={setAlertEnabled} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>분실물 처리 기록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reports.map((entry) => (
              <div key={entry.id} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold">{entry.itemName}</p>
                <p className="text-muted-foreground">
                  {entry.createdAt} / {entry.location}
                </p>
                <p className="mt-1 text-xs font-semibold text-primary">
                  상태:{" "}
                  {entry.status === "pending"
                    ? "관리자 확인 중"
                    : entry.status === "resolved"
                      ? "습득 완료"
                      : entry.status === "picked_up"
                        ? "최종 수령 완료"
                        : "습득 불가"}
                </p>
                {entry.pickedUpAt ? <p className="mt-1 text-xs text-muted-foreground">수령 시각: {entry.pickedUpAt}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최종 수령 QR 인증</CardTitle>
            <p className="text-sm text-muted-foreground">습득 완료된 항목은 QR 발급 후 관리실에서 최종 수령 인증을 진행합니다.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {reports.filter((report) => report.status === "resolved" || report.status === "picked_up").length === 0 ? (
              <p className="rounded-lg border bg-slate-50 p-3 text-sm text-muted-foreground">
                아직 QR 발급 가능한 항목이 없습니다. 관리자 페이지에서 먼저 <b>습득 완료 처리</b>가 되면 여기서 QR이 표시됩니다.
              </p>
            ) : null}
            {reports
              .filter((report) => report.status === "resolved" || report.status === "picked_up")
              .map((report) => {
                const pass = pickupPasses.find((item) => item.reportId === report.id);
                return (
                  <div key={report.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-semibold">{report.itemName}</p>
                    <p className="text-muted-foreground">{report.location}</p>
                    {pass ? (
                      <div className="mt-2 rounded-lg border bg-slate-50 p-3">
                        <p className="text-xs text-muted-foreground">수령 코드 (QR)</p>
                        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center">
                          <PickupQr value={pass.token} />
                          <div className="space-y-1">
                            <p className="text-lg font-bold tracking-wider">{pass.token}</p>
                            <p className="text-xs text-muted-foreground">
                              유효기간: {new Date(pass.expiresAt).toLocaleString("ko-KR", { hour12: false })}
                            </p>
                            <p className="text-xs font-semibold text-primary">
                              {pass.usedAt ? `인증 완료 (${pass.usedAt})` : "관리실에서 QR 확인 대기 중"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <Button size="sm" onClick={() => void issueQr(report.id)} disabled={report.status === "picked_up"}>
                          수령 QR 발급
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            {pickupMessage ? <p className="text-sm font-semibold text-primary">{pickupMessage}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-primary" />
              사용자 알림함
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notices.map((notice) => (
              <button
                key={notice.id}
                type="button"
                onClick={() => markNoticeRead(notice.id)}
                className={`w-full rounded-xl border p-3 text-left text-sm ${notice.read ? "bg-slate-50" : "bg-primary/5"}`}
              >
                <p className="font-semibold">{notice.title}</p>
                <p className="text-muted-foreground">{notice.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{notice.createdAt}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>하단 마이페이지 메뉴</CardTitle>
          </CardHeader>
          <CardContent>
            <AccountMenu fullWidth label="마이페이지 메뉴" />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
