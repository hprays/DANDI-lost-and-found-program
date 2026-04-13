import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function DandiLogo({ className }: { className?: string }) {
  return (
    <Link href="/home" className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative h-11 w-11 shrink-0 overflow-hidden md:h-12 md:w-12">
        <Image
          src="/dandi-logo-clean.png"
          alt="DANDI 로고"
          fill
          priority
          sizes="(max-width: 768px) 44px, 48px"
          className="object-cover [object-position:50%_20%]"
        />
      </span>
      <span className="text-3xl font-extrabold leading-none tracking-tight text-primary md:text-4xl">DANDI</span>
    </Link>
  );
}
