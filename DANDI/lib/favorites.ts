"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson, getApiBaseUrl } from "@/lib/api-json";
import { getAuthSession } from "@/lib/auth-session";
import { safeSetLocalStorage } from "@/lib/safe-local-storage";

/**
 * 관심 물품 — 서버(/api/users/favorites)가 기준이고 localStorage는 캐시.
 * 서버에 API가 없거나 실패하면 이 기기에만 저장된다.
 */
const FAVORITES_CHANGED_EVENT = "dandi-favorites-changed";

const account = () => getAuthSession()?.email ?? "guest";
const favoritesKey = () => `dandi.favorites.v1:${account()}`;
// 서버 연동 전 이 기기에 저장한 하트를 처음 한 번만 서버로 올린다
const migratedKey = () => `dandi.favorites.migrated.v1:${account()}`;

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(favoritesKey()) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeFavorites(ids: string[]) {
  if (safeSetLocalStorage(favoritesKey(), JSON.stringify(ids))) {
    window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
  }
}

const favoritePath = (id: string) => `/api/users/favorites/${encodeURIComponent(id)}`;

function sendToServer(id: string, adding: boolean) {
  apiJson<void>(favoritePath(id), { method: adding ? "PUT" : "DELETE" }).catch(() => {
    // 서버 저장 실패 — 다른 기기와 어긋나지 않도록 이 항목만 되돌린다
    const now = readFavorites();
    writeFavorites(adding ? now.filter((v) => v !== id) : now.includes(id) ? now : [...now, id]);
  });
}

// 서버 목록을 불러오는 동안 누른 하트 (id → 켬/끔). 목록이 도착하면 그 위에 적용한다
const pending = new Map<string, boolean>();

async function syncFromServer(): Promise<Array<[string, boolean]>> {
  const rows = await apiJson<Array<{ lostItemId: string }>>("/api/users/favorites", { method: "GET" });
  const serverIds = rows.map((r) => String(r.lostItemId));
  if (window.localStorage.getItem(migratedKey()) !== "true") {
    const localOnly = readFavorites().filter((id) => !serverIds.includes(id));
    // 삭제된 물품(404) 등 실패한 항목은 버린다
    const uploaded = await Promise.allSettled(
      localOnly.map((id) => apiJson<void>(favoritePath(id), { method: "PUT" }).then(() => id))
    );
    uploaded.forEach((r) => {
      if (r.status === "fulfilled") serverIds.push(r.value);
    });
    safeSetLocalStorage(migratedKey(), "true");
  }
  let ids = serverIds;
  pending.forEach((adding, id) => {
    ids = adding ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((v) => v !== id);
  });
  writeFavorites(ids);
  const queued = [...pending];
  pending.clear();
  return queued;
}

// 화면마다 훅이 있어도 서버 조회는 계정당 한 번. 조회에 성공한 계정만 하트를 서버에 저장한다
let syncPromise: Promise<void> | null = null;
let syncAccount: string | null = null;
let syncingFor: string | null = null;
let serverReadyFor: string | null = null;

/** 계정별 관심 물품 id 목록 — 같은 화면의 여러 하트 버튼이 함께 갱신된다 */
export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setIds(readFavorites());
    sync();
    window.addEventListener(FAVORITES_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    const who = account();
    if (getApiBaseUrl() && getAuthSession()?.accessToken && (syncPromise === null || syncAccount !== who)) {
      syncAccount = who;
      syncingFor = who;
      syncPromise = syncFromServer()
        .then((queued) => {
          serverReadyFor = who;
          queued.forEach(([id, adding]) => sendToServer(id, adding));
        })
        .catch(() => {
          // 서버 미배포·네트워크 오류 — 이 기기에만 저장하며 계속 동작
          pending.clear();
        })
        .finally(() => {
          syncingFor = null;
        });
    }
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const before = readFavorites();
    const adding = !before.includes(id);
    writeFavorites(adding ? [...before, id] : before.filter((v) => v !== id));
    if (serverReadyFor === account()) sendToServer(id, adding);
    else if (syncingFor === account()) pending.set(id, adding);
  }, []);

  return { ids, isFavorite: (id: string) => ids.includes(id), toggle };
}
