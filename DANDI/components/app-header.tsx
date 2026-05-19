"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { DandiLogo } from "@/components/dandi-logo";
import { Button } from "@/components/ui/button";
import { useDandiState } from "@/lib/dandi-state";

export function AppHeader({ subtitle }: { subtitle?: string }) {
  const { notices } = useDandiState();
  const unreadCount = notices.filter((n) => !n.read).length;

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b bg-white/95 px-4 pb-3 pt-safe backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between">
        <div className="flex min-w-0 flex-col justify-center">
          <DandiLogo />
          {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link href="/register-item">분실 신고</Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label={`알림 (미읽음 ${unreadCount}건)`} className="relative">
            <Link href="/mypage#notices">
              <Bell className="h-5 w-5 text-slate-600" />
              {unreadCount > 0 ? (
                <span className="absolute right-1 top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </Button>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
