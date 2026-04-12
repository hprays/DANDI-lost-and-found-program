"use client";

import { useState } from "react";
import { Clock3, MapPin, Navigation, Phone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { officeMarkers } from "@/lib/mock-data";

export default function MapPage() {
  const [activeOffice, setActiveOffice] = useState(officeMarkers[0]);

  return (
    <AppShell subtitle="관리실 위치와 운영시간을 확인해보세요.">
      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>캠퍼스 지도</CardTitle>
            <p className="text-sm text-muted-foreground">현재 위치 기준 주변 관리실 핀 표시 (Google Maps API 연동 영역)</p>
          </CardHeader>
          <CardContent>
            <div className="relative h-72 rounded-xl border bg-slate-100">
              <div id="google-map-canvas" className="h-full w-full rounded-xl" />
              <Badge className="absolute left-3 top-3">Map Placeholder</Badge>
              <div className="absolute bottom-3 left-3 rounded-md bg-primary px-3 py-1 text-xs text-white">현재 위치</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{activeOffice.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{activeOffice.location}</p>
            <p className="text-muted-foreground">{activeOffice.address}</p>
            <p className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              현재 위치 기준 가장 가까운 관리실 후보
            </p>
            <p className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" />
              {activeOffice.hours}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              {activeOffice.phone}
            </p>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3">
          <p className="text-sm font-semibold">관리실/현황판 핀 목록</p>
          <Badge variant="secondary">{officeMarkers.length}개 핀</Badge>
        </div>

        <div className="grid gap-2">
          {officeMarkers.map((office) => (
            <button
              key={office.name}
              type="button"
              onClick={() => setActiveOffice(office)}
              className={`rounded-xl border bg-white p-4 text-left transition hover:border-primary/50 ${
                activeOffice.name === office.name ? "border-primary" : ""
              }`}
            >
              <p className="flex items-center gap-2 font-semibold">
                <MapPin className="h-4 w-4 text-primary" />
                {office.name}
              </p>
              <p className="text-sm text-muted-foreground">{office.location}</p>
            </button>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
