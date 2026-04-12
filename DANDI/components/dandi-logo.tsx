import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export function DandiLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2.5 font-bold text-primary", className)}>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
        <MapPin className="h-5 w-5 text-primary" />
      </span>
      <span className="text-2xl tracking-tight text-primary">DANDI</span>
    </div>
  );
}
