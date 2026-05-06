import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, CalendarDays, PlusCircle, Flag, Image, ScanLine, Sparkles, UserCog, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteHeader } from "./SiteHeader";
import { RoleGuard } from "@/components/common/RoleGuard";

const items = [
  { to: "/host/profile", label: "Host Profile", icon: UserCog },
  { to: "/host", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/host/events", label: "My Events", icon: CalendarDays },
  { to: "/host/events/new", label: "Create Event", icon: PlusCircle },
  { to: "/host/check-in", label: "Check-In", icon: ScanLine },
  { to: "/host/gallery", label: "Gallery Moderation", icon: Image },
  { to: "/host/reports", label: "Reports", icon: Flag },
  { to: "/host/invite", label: "Invite Hosts", icon: UserPlus },
];

export const HostLayout = () => (
  <RoleGuard roles={["host", "admin"]} redirectTo="/become-host">
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="container flex-1 py-6 md:py-10">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <aside className="md:sticky md:top-20 md:self-start">
            <div className="rounded-xl border border-border/60 bg-card p-2 shadow-soft">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Host Console
              </div>
              <nav className="space-y-0.5">
                {items.map((it) => (
                  <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <it.icon className="h-4 w-4" />
                    {it.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </aside>
          <div className="min-w-0"><Outlet /></div>
        </div>
      </div>
    </div>
  </RoleGuard>
);
