"use client";

import { useEffect, useState } from "react";
import type { PickupPass } from "@/lib/dandi-state";

export type PickupPassState = "active" | "expired" | "used";

/** 수령 QR 상태 — 서버가 만료 QR 검증을 거부하므로 화면도 expiresAt을 기준으로 구분한다 */
export function pickupPassState(pass: Pick<PickupPass, "usedAt" | "expiresAt">, now: number): PickupPassState {
  if (pass.usedAt) return "used";
  const expiresMs = Date.parse(pass.expiresAt);
  if (Number.isNaN(expiresMs) || expiresMs <= now) return "expired";
  return "active";
}

/** 열어 둔 화면에서도 만료 시점이 지나면 상태가 바뀌도록 주기적으로 현재 시각을 갱신 */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
