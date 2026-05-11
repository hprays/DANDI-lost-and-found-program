"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { getAuthSession, type AuthSession } from "@/lib/auth-session";

export function AppShell({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setSession(getAuthSession());
      setCheckingAuth(false);
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (checkingAuth) return;
    if (!session?.accessToken) {
      router.replace("/login");
      return;
    }
    if (!session.profileCompleted) {
      router.replace("/onboarding");
    }
  }, [checkingAuth, router, session]);

  if (checkingAuth || !session?.accessToken || !session.profileCompleted) {
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
