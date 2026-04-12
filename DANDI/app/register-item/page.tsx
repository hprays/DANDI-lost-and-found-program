"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDandiState } from "@/lib/dandi-state";

export default function RegisterItemPage() {
  const { reports, submitReport, deleteReport, adminVerified } = useDandiState();
  const [isVisionLoading, setIsVisionLoading] = useState(false);
  const [itemName, setItemName] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [place, setPlace] = useState("");
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState("기타");
  const [savedMessage, setSavedMessage] = useState("");

  const onVisionClick = () => {
    setIsVisionLoading(true);
    setTimeout(() => setIsVisionLoading(false), 1200);
  };

  const onSubmit = () => {
    if (!itemName.trim() || !dateTime || !place.trim()) {
      setSavedMessage("물품명, 일시, 장소를 입력해 주세요.");
      return;
    }
    submitReport({
      itemName: itemName.trim(),
      category,
      lostAt: dateTime,
      location: place.trim(),
      memo: memo.trim(),
    });
    setItemName("");
    setDateTime("");
    setPlace("");
    setMemo("");
    setSavedMessage("관리자에게 신고가 전달되었습니다. 처리 상태는 마이페이지에서 확인하세요.");
  };

  return (
    <AppShell subtitle="분실/습득 정보를 등록하고 관리자에게 전달합니다.">
      <Card>
        <CardHeader>
          <CardTitle>분실물 등록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="photo">사진 업로드</Label>
            <Input id="photo" type="file" accept="image/*" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-name">물품명</Label>
            <Input id="item-name" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="예: 에어팟 케이스" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-category">카테고리</Label>
            <Input id="item-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예: 전자기기" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date-time">분실/습득 일시</Label>
              <Input id="date-time" type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place">분실/습득 장소</Label>
              <Input id="place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="예: 도서관 2층 열람실" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo">상세 설명</Label>
            <Textarea id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="특징(색상, 스티커, 분실 경위 등)을 입력해 주세요." />
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-sm font-semibold">관리자 전용 기능</p>
            {adminVerified ? (
              <div className="mt-3 space-y-3">
                <Button type="button" variant="secondary" onClick={onVisionClick} disabled={isVisionLoading}>
                  {isVisionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Google Vision API 정보 추출
                </Button>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="id-check">신분증 확인란 (사진 없음)</Label>
                    <Input id="id-check" placeholder="예: 학생증 확인 완료" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otp">OTP 인증 입력칸</Label>
                    <Input id="otp" placeholder="6자리 OTP" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                관리자 인증 완료 후 사진 분석/장부 기록 기능이 열립니다.
                <Button asChild variant="outline" size="sm" className="ml-2 bg-white">
                  <Link href="/admin">관리자 OTP 인증하기</Link>
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <Button onClick={onSubmit}>관리자에게 등록 요청 보내기</Button>
            <Button variant="outline" onClick={() => setSavedMessage("대기 목록에서 개별 삭제할 수 있습니다.")}>
              잘못 등록한 항목은 아래에서 삭제
            </Button>
          </div>
          {savedMessage ? <p className="text-sm font-medium text-primary">{savedMessage}</p> : null}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>관리자 전달 대기 목록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reports
            .filter((report) => report.status === "pending")
            .map((report) => (
              <div key={report.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <div>
                  <p className="font-semibold">{report.itemName}</p>
                  <p className="text-muted-foreground">
                    {report.location} / {report.createdAt}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => deleteReport(report.id)}>
                  삭제
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
