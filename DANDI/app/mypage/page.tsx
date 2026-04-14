"use client";

import { useState } from "react";
import { BellRing, Plus, X } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDandiState } from "@/lib/dandi-state";

export default function MyPage() {
  const { notices, reports, markNoticeRead } = useDandiState();
  const [keyword, setKeyword] = useState("");
  const [tags, setTags] = useState<string[]>(["에어팟", "검정", "지갑"]);
  const [alertEnabled, setAlertEnabled] = useState(true);

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
                  상태: {entry.status === "pending" ? "관리자 확인 중" : entry.status === "resolved" ? "습득 완료" : "습득 불가"}
                </p>
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
