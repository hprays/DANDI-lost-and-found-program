"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { Badge } from "@/components/ui/badge";
import { officeMarkers } from "@/lib/mock-data";

type Office = (typeof officeMarkers)[number];

function clearLeafletContainer(el: HTMLElement | null) {
  if (!el) return;
  const leafletEl = el as HTMLElement & { _leaflet_id?: number };
  if (leafletEl._leaflet_id != null) {
    delete leafletEl._leaflet_id;
  }
  el.innerHTML = "";
}

type CampusMapProps = {
  activeOffice: Office;
  onOfficeSelect: (office: Office) => void;
};

export function CampusMap({ activeOffice, onOfficeSelect }: CampusMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const osmMapRef = useRef<LeafletMap | null>(null);
  const osmMarkerRef = useRef<Map<string, LeafletMarker>>(new Map());
  const userLocationMarkerRef = useRef<LeafletMarker | null>(null);
  const onOfficeSelectRef = useRef(onOfficeSelect);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onOfficeSelectRef.current = onOfficeSelect;
  }, [onOfficeSelect]);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let resizeHandler: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const markerMap = osmMarkerRef.current;
    const resizeTimers: number[] = [];
    const containerEl = mapRef.current;

    const initOsmMap = async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      clearLeafletContainer(mapRef.current);

      // 페이지 전환 애니메이션(약 220ms) 이후 초기화
      await new Promise<void>((resolve) => window.setTimeout(resolve, 280));

      if (cancelled || !mapRef.current) return;

      let waitedFrames = 0;
      while (
        !cancelled &&
        mapRef.current &&
        (mapRef.current.clientWidth === 0 || mapRef.current.clientHeight === 0) &&
        waitedFrames < 30
      ) {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        waitedFrames += 1;
      }

      if (cancelled || !mapRef.current) return;

      clearLeafletContainer(mapRef.current);

      const map = L.map(mapRef.current, {
        zoomControl: true,
        preferCanvas: true,
      }).setView([37.3219, 127.1264], 16);

      osmMapRef.current = map;

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
        marker.on("click", () => onOfficeSelectRef.current(office));
        markerMap.set(office.name, marker);
      });

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (cancelled || !osmMapRef.current) return;

            const mapInstance = osmMapRef.current;
            setGeoLocation({ lat: position.coords.latitude, lng: position.coords.longitude });

            const myIcon = L.divIcon({
              className: "",
              html: '<span style="display:inline-block;width:14px;height:14px;border-radius:9999px;background:#0ea5e9;border:2px solid #fff;box-shadow:0 0 0 4px rgba(14,165,233,.25)"></span>',
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            });

            userLocationMarkerRef.current?.remove();
            userLocationMarkerRef.current = L.marker(
              [position.coords.latitude, position.coords.longitude],
              { icon: myIcon }
            )
              .addTo(mapInstance)
              .bindPopup("현재 위치");
          },
          (err) => {
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

      const invalidate = () => {
        if (osmMapRef.current) osmMapRef.current.invalidateSize({ animate: false });
      };

      [100, 300, 600, 1200, 2000].forEach((delay) => {
        const tid = window.setTimeout(() => {
          if (!cancelled) invalidate();
        }, delay);
        resizeTimers.push(tid);
      });

      resizeHandler = invalidate;
      window.addEventListener("resize", resizeHandler);

      if (typeof ResizeObserver !== "undefined" && mapRef.current) {
        resizeObserver = new ResizeObserver(invalidate);
        resizeObserver.observe(mapRef.current);
      }

      setMapReady(true);
      invalidate();
    };

    void initOsmMap();

    return () => {
      cancelled = true;
      resizeTimers.forEach((tid) => window.clearTimeout(tid));
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      resizeObserver?.disconnect();
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
      if (osmMapRef.current) {
        osmMapRef.current.remove();
        osmMapRef.current = null;
      }
      clearLeafletContainer(containerEl);
      markerMap.clear();
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !osmMapRef.current || !mapRef.current?.isConnected) return;
    const map = osmMapRef.current;
    const marker = osmMarkerRef.current.get(activeOffice.name);
    const rafId = window.requestAnimationFrame(() => {
      if (!osmMapRef.current || !mapRef.current?.isConnected) return;
      try {
        map.invalidateSize({ animate: false });
        map.setView([activeOffice.lat, activeOffice.lng], 17, { animate: true });
        marker?.openPopup();
      } catch {
        // Leaflet pane not ready (_leaflet_pos)
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [activeOffice, mapReady]);

  const onMoveToCurrent = () => {
    if (!osmMapRef.current || !geoLocation) return;
    osmMapRef.current.setView([geoLocation.lat, geoLocation.lng], 17, { animate: true });
  };

  return (
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
      {geoError ? <Badge className="absolute right-3 top-3 bg-amber-500 text-[10px]">{geoError}</Badge> : null}
    </div>
  );
}
