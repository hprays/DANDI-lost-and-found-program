"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DandiLogo } from "@/components/dandi-logo";

const menus = [
  { href: "#features", label: "주요 기능" },
  { href: "#how-it-works", label: "사용 방법" },
  { href: "#faq", label: "FAQ" },
];

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-white/85 backdrop-blur-md">
      <div className="container grid h-16 grid-cols-[1fr_auto] items-center md:grid-cols-3">
        <div className="justify-self-start">
          <DandiLogo />
        </div>

        <nav className="hidden items-center justify-center gap-8 md:flex">
          {menus.map((menu) => (
            <Link key={menu.href} href={menu.href} className="text-sm font-semibold text-slate-600 transition-colors hover:text-primary">
              {menu.label}
            </Link>
          ))}
        </nav>

        <div className="hidden justify-self-end md:block">
          <Button asChild className="rounded-full px-6">
            <Link href="/login">시작하기</Link>
          </Button>
        </div>

        <div className="justify-self-end md:hidden">
          <details className="group relative">
            <summary className="list-none">
              <Button variant="ghost" size="icon" aria-label="메뉴 열기">
                <Menu className="h-5 w-5" />
              </Button>
            </summary>
            <div className="absolute right-0 mt-2 w-56 space-y-2 rounded-xl border bg-white p-3 shadow-lg">
                {menus.map((menu) => (
                  <Link key={menu.href} href={menu.href} className="block rounded-lg px-3 py-2 text-base font-semibold hover:bg-accent">
                    {menu.label}
                  </Link>
                ))}
                <Button asChild className="w-full rounded-full">
                  <Link href="/login">시작하기</Link>
                </Button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
