import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function DandiLogo({ className }: { className?: string }) {
  return (
    <Link href="/home" className={cn("inline-flex items-center", className)}>
      <span className="relative h-11 w-44 shrink-0 overflow-hidden md:h-12 md:w-52">
        <Image src="/dandi-logo-full.png" alt="DANDI 로고" fill priority sizes="(max-width: 768px) 176px, 208px" className="object-contain object-left" />
      </span>
    </Link>
  );
}
