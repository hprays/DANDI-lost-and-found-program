"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { getAuthSession } from "@/lib/auth-session";

export function AppShell({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const session = getAuthSession();

  useEffect(() => {
    if (!session?.accessToken) {
      router.replace("/login");
      return;
    }
    if (!session.profileCompleted) {
      router.replace("/onboarding");
    }
  }, [router, session]);

  if (!session?.accessToken || !session.profileCompleted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-muted-foreground">인증 상태를 확인하고 있습니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <AppHeader subtitle={subtitle} />
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="mx-auto w-full max-w-screen-xl px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[calc(5.75rem+env(safe-area-inset-top))] md:pb-28"
      >
        {children}
      </motion.main>
      <MobileBottomNav />
    </div>
  );
}
