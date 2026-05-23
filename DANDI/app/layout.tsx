import type { Metadata } from "next";
import "./globals.css";
import { DandiStateProvider } from "@/lib/dandi-state";

export const metadata: Metadata = {
  title: "DANDI 분실물 찾기 프로그램",
  description: "단국대학교 캠퍼스 분실·습득물 찾기 웹 서비스 (단디)",
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
