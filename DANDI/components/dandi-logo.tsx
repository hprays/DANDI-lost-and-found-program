import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function DandiLogo({ className }: { className?: string }) {
  return (
    <Link href="/home" className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative h-12 w-12 shrink-0 overflow-hidden md:h-14 md:w-14">
        <Image
          src="/dandi-logo-mark.png"
          alt="DANDI 로고"
          fill
          priority
          sizes="(max-width: 768px) 48px, 56px"
          className="object-contain mix-blend-multiply"
        />
      </span>
      <span className="text-2xl font-extrabold leading-none tracking-tight text-primary md:text-3xl">DANDI</span>
    </Link>
  );
}
