import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type Variant = "default" | "success" | "warning" | "destructive" | "accent" | "muted";

const styles: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  accent: "bg-accent text-accent-foreground",
  muted: "bg-foreground text-background",
};

export const StatusBadge = ({ children, variant = "default", className }: { children: ReactNode; variant?: Variant; className?: string }) => (
  <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm ring-1 ring-black/10", styles[variant], className)}>
    {children}
  </span>
);
