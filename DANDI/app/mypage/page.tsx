"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BellRing, Loader2, Plus, X } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { AppShell } from "@/components/app-shell";
import { PickupQr } from "@/components/pickup-qr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getAuthSession } from "@/lib/auth-session";
import { useDandiState } from "@/lib/dandi-state";

export default function MyPage() {
  const { notices, reports, pickupPasses, markNoticeRead, refreshNotices, noticesLoading, noticesError, apiConfigured, apiBaseUrl } =
    useDandiState();
  const session = getAuthSession();
  const [keyword, setKeyword] = useState("");
  const [tags, setTags] = useState<string[]>(["에어팟", "검정", "지갑"]);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [noticeMessage, setNoticeMessage] = useState("");
  const [readingNoticeId, setReadingNoticeId] = useState<string | null>(null);

  // 내가 발급받은 수령 QR만 노출 (이메일 일치 기준, 세션 없으면 전체 노출)
  const myPickupPasses = useMemo(() => {
    if (!session?.email) return pickupPasses;
    return pickupPasses.filter((pass) => !pass.claimantEmail || pass.claimantEmail === session.email);
  }, [pickupPasses, session?.email]);

  const addTag = () => {
    const trimmed = keyword.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
    setKeyword("");
  };

  return (
    <AppShell subtitle="내 정보와 알림 설정을 관리하세요.">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>내 계정</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {!apiConfigured ? (
              <div className="col-span-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                백엔드 주소가 비어 있습니다. `.env.local`에 `NEXT_PUBLIC_API_BASE_URL`을 설정하세요.
              </div>
            ) : (
              <p className="col-span-full text-xs text-muted-foreground">연동 대상 API: {apiBaseUrl}</p>
            )}
            <div className="space-y-2">
              <Label>이름</Label>
              <Input defaultValue={session?.name ?? "홍길동"} readOnly />
            </div>
            <div className="space-y-2">
              <Label>학교 이메일</Label>
              <Input defaultValue={session?.email ?? "example@dankook.ac.kr"} readOnly />
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
            {reports.length === 0 ? (
              <p className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">분실물 처리 기록이 없습니다.</p>
            ) : (
              reports.map((entry) => (
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
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>내 수령 QR</CardTitle>
            <p className="text-sm text-muted-foreground">
              홈/검색에서 분실물을 찾았을 때 발급한 수령 QR이 여기에 모입니다. 관리실 방문 시 QR을 보여주세요.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {myPickupPasses.length === 0 ? (
              <p className="rounded-lg border bg-slate-50 p-3 text-sm text-muted-foreground">
                아직 발급받은 수령 QR이 없습니다. 홈에서 내 물건을 찾았다면 상세 페이지의 <b>“내 물건 — 수령 QR 발급받기”</b> 버튼을 눌러주세요.
              </p>
            ) : null}
            {myPickupPasses.map((pass) => (
              <div key={pass.id} className="rounded-xl border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{pass.itemName ?? "분실물"}</p>
                  {pass.usedAt ? (
                    <Badge variant="secondary">수령 완료</Badge>
                  ) : (
                    <Badge>대기 중</Badge>
                  )}
                </div>
                {pass.itemLocation ? <p className="text-muted-foreground">{pass.itemLocation}</p> : null}
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
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href={`/lost/${pass.lostItemId}`}>해당 분실물 상세 보기</Link>
                </Button>
              </div>
            ))}
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
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">알림을 클릭하면 읽음 처리됩니다.</p>
              <Button variant="outline" size="sm" onClick={() => void refreshNotices()} disabled={noticesLoading}>
                {noticesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                새로고침
              </Button>
            </div>
            {noticesError ? <p className="text-sm font-semibold text-red-600">{noticesError}</p> : null}
            {notices.length === 0 ? (
              <p className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">도착한 알림이 없습니다.</p>
            ) : (
              notices.map((notice) => (
                <button
                  key={notice.id}
                  type="button"
                  onClick={async () => {
                    setReadingNoticeId(notice.id);
                    const result = await markNoticeRead(notice.id);
                    setNoticeMessage(result.message);
                    setReadingNoticeId(null);
                  }}
                  className={`w-full rounded-xl border p-3 text-left text-sm ${notice.read ? "bg-slate-50" : "bg-primary/5"}`}
                >
                  <p className="font-semibold">
                    {notice.title} {!notice.read ? <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] text-white">NEW</span> : null}
                  </p>
                  <p className="text-muted-foreground">{notice.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {notice.createdAt}
                    {readingNoticeId === notice.id ? " · 읽음 처리 중..." : ""}
                  </p>
                </button>
              ))
            )}
            {noticeMessage ? <p className="text-sm font-semibold text-primary">{noticeMessage}</p> : null}
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
