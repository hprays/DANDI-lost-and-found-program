"use client";

import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { DandiLogo } from "@/components/dandi-logo";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";

export function AppHeader({ subtitle }: { subtitle?: string }) {
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
          <NotificationBell />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
