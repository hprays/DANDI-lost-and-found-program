import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function DandiLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2 font-bold text-primary", className)}>
      <Search className="h-5 w-5" />
      <span className="text-xl tracking-tight">단디</span>
      <span className="text-sm text-muted-foreground">DANDI</span>
    </div>
  );
}
