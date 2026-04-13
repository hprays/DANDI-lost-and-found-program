import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function DandiLogo({ className }: { className?: string }) {
  return (
    <Link href="/home" className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative h-11 w-11 shrink-0 overflow-hidden md:h-12 md:w-12">
        <Image src="/dandi-logo-full.png" alt="DANDI 로고" fill priority sizes="(max-width: 768px) 176px, 208px" className="object-contain object-left" />
      </span>
      <span className="text-2xl font-extrabold leading-none tracking-tight text-primary md:text-3xl">DANDI</span>
    </Link>
  );
}
