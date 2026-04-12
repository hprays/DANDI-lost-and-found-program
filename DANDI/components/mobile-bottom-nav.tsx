"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, MapPinned, ShieldCheck, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/home", label: "홈", icon: Home },
  { href: "/map", label: "지도", icon: MapPinned },
  { href: "/admin", label: "관리자", icon: ShieldCheck },
  { href: "/mypage", label: "마이페이지", icon: UserCircle2 },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 pb-safe backdrop-blur">
      <div className="mx-auto grid w-full max-w-screen-md grid-cols-4">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <Link key={tab.href} href={tab.href} className="relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold">
              {active ? (
                <motion.span
                  layoutId="active-tab"
                  className="absolute inset-x-3 top-1 h-10 rounded-xl bg-primary/12"
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                />
              ) : null}
              <motion.div whileTap={{ scale: 0.95 }} className="relative z-10 flex flex-col items-center gap-1">
                <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                <span className={cn(active ? "text-primary" : "text-muted-foreground")}>{tab.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
