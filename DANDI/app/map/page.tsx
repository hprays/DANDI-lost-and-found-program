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
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let resizeHandler: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const markerMap = osmMarkerRef.current;
    const resizeTimers: number[] = [];

    const initOsmMap = async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current || osmMapRef.current) return;

      // 컨테이너 사이즈가 0이면 다음 프레임까지 잠깐 기다림 (라우팅 전환 직후 케이스)
      let waitedFrames = 0;
      while (
        !cancelled &&
        mapRef.current &&
        (mapRef.current.clientWidth === 0 || mapRef.current.clientHeight === 0) &&
        waitedFrames < 20
      ) {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        waitedFrames += 1;
      }

      if (cancelled || !mapRef.current || osmMapRef.current) return;

      const map = L.map(mapRef.current, {
        zoomControl: true,
        preferCanvas: true,
      }).setView([37.3219, 127.1264], 16);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
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
            setGeoLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
            const myIcon = L.divIcon({
              className: "",
              html: '<span style="display:inline-block;width:14px;height:14px;border-radius:9999px;background:#0ea5e9;border:2px solid #fff;box-shadow:0 0 0 4px rgba(14,165,233,.25)"></span>',
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            });

            L.marker([position.coords.latitude, position.coords.longitude], {
              icon: myIcon,
            })
              .addTo(map)
              .bindPopup("현재 위치");
          },
          (err) => {
            // 위치 정보 거부/오류 시 사용자 안내
            const reason =
              err.code === err.PERMISSION_DENIED
                ? "브라우저 위치 권한이 거부되었습니다."
                : err.code === err.POSITION_UNAVAILABLE
                  ? "위치 정보를 가져올 수 없습니다."
                  : err.code === err.TIMEOUT
                    ? "위치 요청이 시간 초과되었습니다."
                    : "위치 정보를 사용할 수 없습니다.";
            setGeoError(reason);
          },
          { enableHighAccuracy: true, maximumAge: 60000, timeout: 8000 }
        );
      } else {
        setGeoError("이 브라우저에서 위치 정보를 지원하지 않습니다.");
      }

      // 페이지 전환/애니메이션 이후에도 타일이 보이도록 여러 번 invalidateSize 호출
      [80, 200, 500, 1200].forEach((delay) => {
        const tid = window.setTimeout(() => {
          if (!cancelled && osmMapRef.current) {
            osmMapRef.current.invalidateSize();
          }
        }, delay);
        resizeTimers.push(tid);
      });

      resizeHandler = () => {
        map.invalidateSize();
      };
      window.addEventListener("resize", resizeHandler);

      // 컨테이너 사이즈 변경 감지 (모바일 회전, 브라우저 UI 변경 등)
      if (typeof ResizeObserver !== "undefined" && mapRef.current) {
        resizeObserver = new ResizeObserver(() => {
          if (osmMapRef.current) {
            osmMapRef.current.invalidateSize();
          }
        });
        resizeObserver.observe(mapRef.current);
      }

      osmMapRef.current = map;
      setMapReady(true);
    };

    void initOsmMap();

    return () => {
      cancelled = true;
      resizeTimers.forEach((tid) => window.clearTimeout(tid));
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
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

  const onMoveToCurrent = () => {
    if (!osmMapRef.current || !geoLocation) return;
    osmMapRef.current.setView([geoLocation.lat, geoLocation.lng], 17, { animate: true });
  };

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
              <button
                type="button"
                onClick={onMoveToCurrent}
                disabled={!geoLocation}
                className="absolute bottom-3 left-3 rounded-md bg-primary px-3 py-1 text-xs text-white shadow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {geoLocation ? "현재 위치로 이동" : geoError ? "위치 사용 불가" : "위치 확인 중..."}
              </button>
              {geoError ? (
                <Badge className="absolute right-3 top-3 bg-amber-500 text-[10px]">{geoError}</Badge>
              ) : null}
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
