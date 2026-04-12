import Link from "next/link";
import { Bell } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { DandiLogo } from "@/components/dandi-logo";
import { Button } from "@/components/ui/button";

export function AppHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/90 px-4 pb-3 pt-safe backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-lg items-center justify-between">
        <div className="flex min-w-0 flex-col justify-center">
          <DandiLogo />
          {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link href="/register-item">분실 신고</Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="알림">
            <Bell className="h-5 w-5 text-slate-600" />
          </Button>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
