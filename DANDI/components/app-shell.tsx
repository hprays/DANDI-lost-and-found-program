"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

export function AppShell({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader subtitle={subtitle} />
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="mx-auto w-full max-w-screen-lg px-4 pb-28 pt-4 md:pb-6"
      >
        {children}
      </motion.main>
      <MobileBottomNav />
    </div>
  );
}
