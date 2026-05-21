'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, MapPinned, ShieldCheck, UserCircle2 } from 'lucide-react';
import { getAuthSession } from '@/lib/auth-session';
import { cn } from '@/lib/utils';

type Tab = {
  href: string;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
};

const ALL_TABS: Tab[] = [
  { href: '/home', label: '홈', icon: Home },
  { href: '/map', label: '지도', icon: MapPinned },
  { href: '/admin', label: '관리자', icon: ShieldCheck, adminOnly: true },
  { href: '/mypage', label: '마이페이지', icon: UserCircle2 },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setIsAdmin(Boolean(getAuthSession()?.isAdmin));
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [pathname]);

  const tabs = ALL_TABS.filter((tab) => !tab.adminOnly || isAdmin);
  const gridColsClass = tabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/96 pb-safe backdrop-blur">
      <div className={cn('mx-auto grid w-full max-w-screen-md', gridColsClass)}>
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold"
            >
              {active ? (
                <motion.span
                  layoutId="active-tab"
                  className="absolute inset-x-2 top-1 h-11 rounded-xl bg-primary/12"
                  transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                />
              ) : null}
              <motion.div
                whileTap={{ scale: 0.95 }}
                className="relative z-10 flex flex-col items-center gap-1"
              >
                <Icon
                  className={cn(
                    'h-5 w-5',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                <span
                  className={cn(
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {tab.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
