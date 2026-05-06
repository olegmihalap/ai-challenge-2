import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Menu, X } from "lucide-react";

import { useState } from "react";
import { cn } from "@/lib/utils";

export const SiteHeader = () => {
  const { user, roles, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const isHost = roles.includes("host") || roles.includes("admin");

  const links = user
    ? [
        { to: "/events", label: "Explore" },
        { to: "/tickets", label: "Tickets" },
        { to: "/my-events", label: "My Events" },
        ...(isHost ? [{ to: "/host", label: "Host Dashboard" }] : []),
      ]
    : [{ to: "/events", label: "Explore" }];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-hero text-primary-foreground shadow-glow">
            <Sparkles className="h-4 w-4" />
          </span>
          Gather
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => cn("rounded-md px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 hover:bg-muted">
                  <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-primary text-xs">{(user.email ?? "U").slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => nav("/tickets")}>My Tickets</DropdownMenuItem>
                <DropdownMenuItem onClick={() => nav("/my-events")}>My Events</DropdownMenuItem>
                {isHost ? (
                  <DropdownMenuItem onClick={() => nav("/host")}>Host Dashboard</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => nav("/become-host")}>Become a host</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); nav("/"); }}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" asChild><Link to="/sign-in">Sign In</Link></Button>
              <Button asChild className="bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95"><Link to="/sign-up">Sign Up</Link></Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          
          <button className="rounded-md p-2 hover:bg-muted" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 md:hidden">
          <div className="container space-y-1 py-3">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className={({ isActive }) => cn("block rounded-md px-3 py-2 text-sm font-medium", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
                {l.label}
              </NavLink>
            ))}
            <div className="mt-2 flex gap-2 pt-2">
              {user ? (
                <Button variant="outline" className="w-full" onClick={async () => { await signOut(); nav("/"); }}>Sign out</Button>
              ) : (
                <>
                  <Button variant="outline" className="flex-1" asChild><Link to="/sign-in">Sign In</Link></Button>
                  <Button className="flex-1 bg-gradient-hero text-primary-foreground" asChild><Link to="/sign-up">Sign Up</Link></Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
