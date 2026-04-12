"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, LogOut, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AccountMenuProps = {
  className?: string;
  fullWidth?: boolean;
  label?: string;
};

export function AccountMenu({ className, fullWidth = false, label = "마이" }: AccountMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100",
          fullWidth ? "w-full justify-between border" : ""
        )}
        aria-expanded={open}
        aria-label="마이페이지 메뉴 토글"
      >
        <span className="inline-flex items-center gap-1">
          <UserCircle2 className="h-4 w-4" />
          {label}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")} />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          fullWidth ? "mt-2" : "absolute right-0 mt-1 w-40",
          open ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className={cn("rounded-lg border bg-white p-1.5 shadow-lg", fullWidth ? "shadow-none" : "")}>
          <Link href="/mypage" className="block rounded-md px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setOpen(false)}>
            마이페이지
          </Link>
          <Link href="/" className="block rounded-md px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setOpen(false)}>
            초기화면
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            onClick={() => setOpen(false)}
          >
            <LogOut className="h-3.5 w-3.5" />
            로그아웃
          </Link>
        </div>
      </div>
    </div>
  );
}
