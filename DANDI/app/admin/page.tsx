"use client";

import { useState } from "react";
import { CheckCircle2, CircleX } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useDandiState } from "@/lib/dandi-state";

export default function AdminPage() {
  const { reports, resolveReport } = useDandiState();
  const [isManagerMode, setIsManagerMode] = useState(true);

  return (
    <AppShell subtitle="관리자 검수 및 상태 처리">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>관리자 권한</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">관리자 모드</span>
            <Switch checked={isManagerMode} onCheckedChange={setIsManagerMode} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{report.itemName}</p>
                <span className="text-xs text-muted-foreground">{report.createdAt}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.location} / 상태:{" "}
                {report.status === "pending" ? "검수 대기" : report.status === "resolved" ? "습득 완료" : "습득 불가"}
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <Button variant="outline" onClick={() => resolveReport(report.id, "resolved")} disabled={report.status !== "pending"}>
                  <CheckCircle2 className="h-4 w-4" />
                  습득 완료 처리
                </Button>
                <Button variant="outline" onClick={() => resolveReport(report.id, "unavailable")} disabled={report.status !== "pending"}>
                  <CircleX className="h-4 w-4" />
                  습득 불가 처리
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
