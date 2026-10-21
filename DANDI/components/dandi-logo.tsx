import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function DandiLogo({ className }: { className?: string }) {
  return (
    <Link href="/home" className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative h-9 w-9 shrink-0 overflow-hidden md:h-11 md:w-11">
        <Image
          src="/dandi-logo-mark.png"
          alt="DANDI 로고"
          fill
          priority
          sizes="(max-width: 768px) 36px, 44px"
          className="object-contain mix-blend-multiply"
        />
      </span>
      <span className="text-xl font-extrabold leading-none tracking-tight text-primary md:text-2xl">DANDI</span>
    </Link>
  );
}
