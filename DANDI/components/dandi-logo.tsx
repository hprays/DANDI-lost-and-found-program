import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function DandiLogo({ className }: { className?: string }) {
  return (
    <Link href="/home" className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md md:h-10 md:w-10">
        <Image
          src="/dandi-logo-full.png"
          alt="DANDI 로고"
          fill
          priority
          sizes="(max-width: 768px) 36px, 40px"
          className="object-cover [object-position:50%_23%]"
        />
      </span>
      <span className="text-2xl font-extrabold leading-none tracking-tight text-primary md:text-3xl">DANDI</span>
    </Link>
  );
}
