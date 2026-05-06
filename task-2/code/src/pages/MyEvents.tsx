import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/event/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { CalendarDays, MapPin, Ticket, Settings, ScanLine, Image as ImageIcon, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyRsvps } from "@/hooks/useEvents";
import { useHostData } from "@/hooks/useHostData";
import { isPastEvent } from "@/lib/event-helpers";
import { supabase } from "@/integrations/supabase/client";

type Role = "hosting" | "attending" | "checking";

interface UnifiedEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  cover_image_url: string | null;
  status: string;
  roles: Role[];
  rsvp_status?: "going" | "waitlist" | "cancelled";
}

const MyEvents = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const isHost = roles.includes("host");
  const isChecker = roles.includes("checker") || roles.includes("admin");

  const { rows: myRsvps, loading: rsvpLoading } = useMyRsvps();
  const { events: hostedEvents, loading: hostLoading } = useHostData();
  const [checkerEvents, setCheckerEvents] = useState<UnifiedEvent[]>([]);
  const [checkerLoading, setCheckerLoading] = useState(isChecker);
  const [tab, setTab] = useState<"all" | "upcoming" | "past" | Role>("all");

  useEffect(() => {
    if (!isChecker) { setCheckerLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title,starts_at,ends_at,location,cover_image_url,status")
        .eq("status", "published")
        .order("starts_at", { ascending: true });
      setCheckerEvents(
        (data ?? []).map((e: any) => ({ ...e, roles: ["checking"] as Role[] }))
      );
      setCheckerLoading(false);
    })();
  }, [isChecker]);

  const merged: UnifiedEvent[] = useMemo(() => {
    const map = new Map<string, UnifiedEvent>();
    const add = (e: any, role: Role, rsvp_status?: any) => {
      const existing = map.get(e.id);
      if (existing) {
        if (!existing.roles.includes(role)) existing.roles.push(role);
        if (rsvp_status) existing.rsvp_status = rsvp_status;
      } else {
        map.set(e.id, {
          id: e.id, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at,
          location: e.location, cover_image_url: e.cover_image_url, status: e.status,
          roles: [role], rsvp_status,
        });
      }
    };
    hostedEvents.forEach((e) => add(e, "hosting"));
    myRsvps.filter((r) => r.status !== "cancelled").forEach((r) => add(r.event, "attending", r.status));
    checkerEvents.forEach((e) => add(e, "checking"));
    return Array.from(map.values()).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  }, [hostedEvents, myRsvps, checkerEvents]);

  const loading = authLoading || rsvpLoading || hostLoading || checkerLoading;
  const hasAccess = isHost || isChecker || myRsvps.some((r) => r.status !== "cancelled");

  if (!authLoading && !user) return <Navigate to="/sign-in" replace />;
  if (loading) return <div className="container py-10"><LoadingState /></div>;

  const filtered = merged.filter((e) => {
    const past = isPastEvent({ starts_at: e.starts_at, ends_at: e.ends_at } as any);
    if (tab === "upcoming") return !past;
    if (tab === "past") return past;
    if (tab === "hosting") return e.roles.includes("hosting");
    if (tab === "attending") return e.roles.includes("attending");
    if (tab === "checking") return e.roles.includes("checking");
    return true;
  });

  const counts = {
    all: merged.length,
    upcoming: merged.filter((e) => !isPastEvent({ starts_at: e.starts_at, ends_at: e.ends_at } as any)).length,
    past: merged.filter((e) => isPastEvent({ starts_at: e.starts_at, ends_at: e.ends_at } as any)).length,
    hosting: merged.filter((e) => e.roles.includes("hosting")).length,
    attending: merged.filter((e) => e.roles.includes("attending")).length,
    checking: merged.filter((e) => e.roles.includes("checking")).length,
  };

  if (!hasAccess) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={CalendarDays}
          title="Nothing here yet"
          description="RSVP to an event, become a host, or get assigned as a checker to see this dashboard."
          action={<Button asChild><Link to="/events">Browse events</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div className="container py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">My Events</h1>
          <p className="mt-1 text-muted-foreground">All events you host, attend, or check in.</p>
        </div>
        {isHost && (
          <Button asChild><Link to="/host/events/new"><Sparkles className="mr-1.5 h-4 w-4" />Create event</Link></Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-6">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="all">All <Badge n={counts.all} /></TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming <Badge n={counts.upcoming} /></TabsTrigger>
          <TabsTrigger value="past">Past <Badge n={counts.past} /></TabsTrigger>
          {isHost && <TabsTrigger value="hosting">Hosting <Badge n={counts.hosting} /></TabsTrigger>}
          {counts.attending > 0 && <TabsTrigger value="attending">Attending <Badge n={counts.attending} /></TabsTrigger>}
          {isChecker && <TabsTrigger value="checking">Checking <Badge n={counts.checking} /></TabsTrigger>}
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          {filtered.length === 0 ? (
            <EmptyForTab tab={tab} isHost={isHost} />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((e) => <EventRow key={e.id} ev={e} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Badge = ({ n }: { n: number }) => (
  <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{n}</span>
);

const ROLE_BADGE: Record<Role, { label: string; variant: "success" | "accent" | "warning" }> = {
  hosting: { label: "Hosting", variant: "accent" },
  attending: { label: "Attending", variant: "success" },
  checking: { label: "Checker", variant: "warning" },
};

const EventRow = ({ ev }: { ev: UnifiedEvent }) => {
  const past = isPastEvent({ starts_at: ev.starts_at, ends_at: ev.ends_at } as any);
  const date = new Date(ev.starts_at);

  return (
    <Card className="flex flex-col overflow-hidden shadow-soft transition hover:shadow-elevated">
      <Link to={`/events/${ev.id}`} className="block">
        {ev.cover_image_url ? (
          <img src={ev.cover_image_url} alt={ev.title} className={`aspect-[16/9] w-full object-cover ${past ? "grayscale-[40%]" : ""}`} />
        ) : (
          <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary/10 to-accent/10" />
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {ev.roles.map((r) => (
            <StatusBadge key={r} variant={ROLE_BADGE[r].variant}>{ROLE_BADGE[r].label}</StatusBadge>
          ))}
          {past && <StatusBadge variant="muted">Ended</StatusBadge>}
          {ev.status === "draft" && <StatusBadge variant="warning">Draft</StatusBadge>}
          {ev.rsvp_status === "waitlist" && <StatusBadge variant="warning">Waitlist</StatusBadge>}
        </div>
        <Link to={`/events/${ev.id}`} className="font-display text-lg font-semibold leading-snug hover:underline">
          {ev.title}
        </Link>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
          {ev.location && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{ev.location}</div>}
        </div>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          {ev.roles.includes("attending") && ev.rsvp_status === "going" && !past && (
            <Button size="sm" variant="outline" asChild><Link to="/tickets"><Ticket className="mr-1.5 h-3.5 w-3.5" />Ticket</Link></Button>
          )}
          {ev.roles.includes("hosting") && (
            <>
              <Button size="sm" variant="outline" asChild><Link to={`/host/events/${ev.id}/edit`}><Settings className="mr-1.5 h-3.5 w-3.5" />Manage</Link></Button>
              <Button size="sm" variant="outline" asChild><Link to="/host/gallery"><ImageIcon className="mr-1.5 h-3.5 w-3.5" />Gallery</Link></Button>
            </>
          )}
          {(ev.roles.includes("checking") || ev.roles.includes("hosting")) && !past && (
            <Button size="sm" asChild><Link to="/host/check-in"><ScanLine className="mr-1.5 h-3.5 w-3.5" />Check-in</Link></Button>
          )}
        </div>
      </div>
    </Card>
  );
};

const EmptyForTab = ({ tab, isHost }: { tab: string; isHost: boolean }) => {
  if (tab === "hosting") return <EmptyState icon={Sparkles} title="No hosted events yet" description="Create your first event to get started." action={isHost ? <Button asChild><Link to="/host/events/new">Create event</Link></Button> : undefined} />;
  if (tab === "attending") return <EmptyState icon={Ticket} title="No RSVPs yet" description="Browse events and grab a ticket." action={<Button asChild><Link to="/events">Browse events</Link></Button>} />;
  if (tab === "checking") return <EmptyState icon={ScanLine} title="No check-in assignments" description="Published events will appear here when you have checker access." />;
  if (tab === "past") return <EmptyState icon={CalendarDays} title="No past events" />;
  if (tab === "upcoming") return <EmptyState icon={CalendarDays} title="No upcoming events" description="Your upcoming hosted, attending, or checker events will appear here." />;
  return <EmptyState icon={CalendarDays} title="Nothing here" />;
};

export default MyEvents;
