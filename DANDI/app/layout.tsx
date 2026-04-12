import type { Metadata } from "next";
import "./globals.css";
import { DandiStateProvider } from "@/lib/dandi-state";

export const metadata: Metadata = {
  title: "단디(DANDI)",
  description: "단국대학교 분실물 플랫폼 프론트엔드",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <DandiStateProvider>{children}</DandiStateProvider>
      </body>
    </html>
  );
}
