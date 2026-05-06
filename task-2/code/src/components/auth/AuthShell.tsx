import { Link, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { ReactNode } from "react";

export const AuthShell = ({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-soft p-4">
    <div className="w-full max-w-md">
      <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-bold">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground shadow-glow"><Sparkles className="h-4 w-4" /></span>
        Gather
      </Link>
      <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-elevated">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
      </div>
    </div>
  </div>
);
