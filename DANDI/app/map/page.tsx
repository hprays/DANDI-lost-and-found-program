"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { Clock3, MapPin, Navigation, Phone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { officeMarkers } from "@/lib/mock-data";

type GoogleMapLike = {
  panTo: (position: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};

type GoogleMarkerLike = {
  addListener: (eventName: string, callback: () => void) => void;
  setAnimation: (animation: unknown) => void;
};

type GoogleInfoWindowLike = {
  setContent: (content: string) => void;
  open: (options: { map: GoogleMapLike; anchor: GoogleMarkerLike }) => void;
};

type GoogleMapsLike = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapLike;
    Marker: new (options: Record<string, unknown>) => GoogleMarkerLike;
    InfoWindow: new () => GoogleInfoWindowLike;
    SymbolPath: { CIRCLE: unknown };
    Animation: { DROP: unknown };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsLike;
  }
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function MapPage() {
  const [activeOffice, setActiveOffice] = useState(officeMarkers[0]);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<GoogleMapLike | null>(null);
  const infoWindowRef = useRef<GoogleInfoWindowLike | null>(null);
  const markerRef = useRef<Map<string, GoogleMarkerLike>>(new Map());
  const osmMapRef = useRef<LeafletMap | null>(null);
  const osmMarkerRef = useRef<Map<string, LeafletMarker>>(new Map());
  const leafletModuleRef = useRef<typeof import("leaflet") | null>(null);
  const missingApiKey = !GOOGLE_MAPS_KEY;

  useEffect(() => {
    if (!missingApiKey || !mapRef.current) return;

    let cancelled = false;

    const initOsmMap = async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current || osmMapRef.current) return;

      leafletModuleRef.current = L;

      const map = L.map(mapRef.current, {
        zoomControl: true,
      }).setView([37.3219, 127.1264], 16);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const officeIcon = L.divIcon({
        className: "",
        html: '<span style="display:inline-block;width:14px;height:14px;border-radius:9999px;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 1px rgba(15,23,42,.2)"></span>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      officeMarkers.forEach((office) => {
        const marker = L.marker([office.lat, office.lng], { icon: officeIcon }).addTo(map);
        marker.bindPopup(`<strong>${office.name}</strong><br/>${office.location}<br/>${office.hours}`);
        marker.on("click", () => {
          setActiveOffice(office);
        });
        osmMarkerRef.current.set(office.name, marker);
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

      osmMapRef.current = map;
      setMapReady(true);
    };

    void initOsmMap();

    return () => {
      cancelled = true;
    };
  }, [missingApiKey]);

  useEffect(() => {
    const initMap = () => {
      if (!window.google || !mapRef.current) return;

      const google = window.google;
      if (!google || !mapRef.current) return;

      const center = { lat: 37.3219, lng: 127.1264 };
      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      mapInstanceRef.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();

      officeMarkers.forEach((office) => {
        const marker = new google.maps.Marker({
          position: { lat: office.lat, lng: office.lng },
          map,
          title: office.name,
        });

        marker.addListener("click", () => {
          setActiveOffice(office);
        });

        markerRef.current.set(office.name, marker);
      });

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            new google.maps.Marker({
              position: { lat: position.coords.latitude, lng: position.coords.longitude },
              map,
              title: "현재 위치",
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: "#2563eb",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
            });
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 60000 }
        );
      }

      setMapReady(true);
    };

    if (missingApiKey) {
      return;
    }

    if (window.google?.maps) {
      initMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&language=ko`;
    script.async = true;
    script.defer = true;
    script.onload = () => initMap();
    script.onerror = () => setScriptError("Google Maps 스크립트 로드에 실패했습니다.");
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [missingApiKey]);

  useEffect(() => {
    if (!mapReady) return;

    if (missingApiKey) {
      if (!osmMapRef.current) return;
      osmMapRef.current.setView([activeOffice.lat, activeOffice.lng], 17, { animate: true });
      const marker = osmMarkerRef.current.get(activeOffice.name);
      marker?.openPopup();
      return;
    }

    if (!mapInstanceRef.current || !window.google) return;

    const google = window.google;
    const marker = markerRef.current.get(activeOffice.name);
    mapInstanceRef.current.panTo({ lat: activeOffice.lat, lng: activeOffice.lng });
    mapInstanceRef.current.setZoom(17);

    if (marker && infoWindowRef.current) {
      infoWindowRef.current.setContent(
        `<div style="font-size:13px;line-height:1.4;"><strong>${activeOffice.name}</strong><br/>${activeOffice.location}<br/>${activeOffice.hours}</div>`
      );
      infoWindowRef.current.open({ map: mapInstanceRef.current, anchor: marker });
      marker.setAnimation(google.maps.Animation.DROP);
      setTimeout(() => marker.setAnimation(null), 650);
    }
  }, [activeOffice, mapReady, missingApiKey]);

  return (
    <AppShell subtitle="관리실 위치와 운영시간을 확인해보세요.">
      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>캠퍼스 지도</CardTitle>
            <p className="text-sm text-muted-foreground">현재 위치 기준 주변 관리실 핀 표시 (Google Maps 또는 OpenStreetMap)</p>
          </CardHeader>
          <CardContent>
            <div className="relative h-72 rounded-xl border bg-slate-100">
              <div ref={mapRef} id="google-map-canvas" className="h-full w-full rounded-xl" />
              {missingApiKey ? (
                <Badge className="absolute left-3 top-3 bg-emerald-600">OpenStreetMap 핀 표시 중</Badge>
              ) : null}
              {scriptError ? <Badge className="absolute left-3 top-3 bg-red-600">{scriptError}</Badge> : null}
              {!missingApiKey && !scriptError ? <Badge className="absolute left-3 top-3">Google Maps</Badge> : null}
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
