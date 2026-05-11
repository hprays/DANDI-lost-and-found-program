"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { Clock3, MapPin, Navigation, Phone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { officeMarkers } from "@/lib/mock-data";

export default function MapPage() {
  const [activeOffice, setActiveOffice] = useState(officeMarkers[0]);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const osmMapRef = useRef<LeafletMap | null>(null);
  const osmMarkerRef = useRef<Map<string, LeafletMarker>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let resizeHandler: (() => void) | null = null;
    const markerMap = osmMarkerRef.current;

    const initOsmMap = async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current || osmMapRef.current) return;

      const map = L.map(mapRef.current, {
        zoomControl: true,
      }).setView([37.3219, 127.1264], 16);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const officeIcon = L.divIcon({
        className: "",
        html: `
          <span style="position:relative;display:inline-block;width:22px;height:30px;">
            <span style="position:absolute;left:3px;top:0;width:16px;height:16px;border-radius:9999px;background:#2563eb;border:2px solid #fff;box-shadow:0 1px 6px rgba(15,23,42,.35);"></span>
            <span style="position:absolute;left:8px;top:14px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:10px solid #2563eb;"></span>
          </span>
        `,
        iconSize: [22, 30],
        iconAnchor: [11, 29],
      });

      officeMarkers.forEach((office) => {
        const marker = L.marker([office.lat, office.lng], { icon: officeIcon }).addTo(map);
        marker.bindPopup(`<strong>${office.name}</strong><br/>${office.location}<br/>${office.hours}`);
        marker.on("click", () => setActiveOffice(office));
        markerMap.set(office.name, marker);
      });

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const myIcon = L.divIcon({
              className: "",
              html: '<span style="display:inline-block;width:12px;height:12px;border-radius:9999px;background:#0ea5e9;border:2px solid #fff;box-shadow:0 0 0 1px rgba(15,23,42,.25)"></span>',
              iconSize: [12, 12],
              iconAnchor: [6, 6],
            });

            L.marker([position.coords.latitude, position.coords.longitude], {
              icon: myIcon,
            })
              .addTo(map)
              .bindPopup("현재 위치");
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 60000 }
        );
      }

      // 화면 전환 애니메이션 이후에도 타일이 보이도록 강제 리사이즈를 한 번 더 수행합니다.
      window.setTimeout(() => {
        map.invalidateSize();
      }, 120);

      resizeHandler = () => {
        map.invalidateSize();
      };
      window.addEventListener("resize", resizeHandler);

      osmMapRef.current = map;
      setMapReady(true);
    };

    void initOsmMap();

    return () => {
      cancelled = true;
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      if (osmMapRef.current) {
        osmMapRef.current.remove();
        osmMapRef.current = null;
      }
      markerMap.clear();
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !osmMapRef.current) return;
    osmMapRef.current.setView([activeOffice.lat, activeOffice.lng], 17, { animate: true });
    osmMarkerRef.current.get(activeOffice.name)?.openPopup();
  }, [activeOffice, mapReady]);

  return (
    <AppShell subtitle="관리실 위치와 운영시간을 확인해보세요.">
      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>캠퍼스 지도</CardTitle>
            <p className="text-sm text-muted-foreground">현재 위치 기준 주변 관리실 핀 표시 (OpenStreetMap)</p>
          </CardHeader>
          <CardContent>
            <div className="relative h-72 rounded-xl border bg-slate-100">
              <div ref={mapRef} className="h-full w-full rounded-xl" />
              <Badge className="absolute left-3 top-3 bg-emerald-600">OpenStreetMap</Badge>
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
