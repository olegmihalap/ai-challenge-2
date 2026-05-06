import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/event/StatusBadge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Pencil, ScanLine, Image as ImageIcon, MoreVertical, Eye, EyeOff, PlusCircle,
  CalendarDays, Download, Ticket, Search, CalendarIcon,
} from "lucide-react";
import { useHostData, type HostEventRow } from "@/hooks/useHostData";
import { useMyRsvps } from "@/hooks/useEvents";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isPastEvent } from "@/lib/event-helpers";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Role = "hosting" | "attending" | "checking";

interface UnifiedEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  cover_image_url: string | null;
  status: "draft" | "published" | "cancelled" | "completed";
  capacity: number;
  attending: number;
  waitlist: number;
  roles: Role[];
  rsvp_status?: "going" | "waitlist" | "cancelled";
}

const STATUS_VARIANT = {
  draft: "muted",
  published: "success",
  cancelled: "destructive",
  completed: "default",
} as const;

const ROLE_BADGE: Record<Role, { label: string; variant: "success" | "accent" | "warning" }> = {
  hosting: { label: "Hosting", variant: "accent" },
  attending: { label: "Attending", variant: "success" },
  checking: { label: "Checker", variant: "warning" },
};

const Row = ({ e, onChange }: { e: UnifiedEvent; onChange: () => void }) => {
  const [confirm, setConfirm] = useState<null | "publish" | "unpublish">(null);
  const ended = isPastEvent(e as any);
  const isHosting = e.roles.includes("hosting");
  const isCheckingOrHosting = isHosting || e.roles.includes("checking");

  const setStatus = async (status: "published" | "draft") => {
    setConfirm(null);
    const { error } = await supabase.from("events").update({ status }).eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success(status === "published" ? "Event published" : "Event unpublished");
    onChange();
  };

  const exportCsv = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return toast.error("Please sign in again");
      const url = `https://cdpfzmbwsewydqpvknpc.supabase.co/functions/v1/export-rsvps?event_id=${e.id}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.text()) || "Export failed");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/i);
      const filename = m?.[1] || `rsvps_${e.id}.csv`;
      const a = document.createElement("a");
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      toast.success("CSV downloaded");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
        {e.cover_image_url ? (
          <img src={e.cover_image_url} alt="" className="h-14 w-20 flex-shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-14 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <CalendarDays className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Link to={`/events/${e.id}`} className="block truncate font-medium hover:text-primary">
            {e.title}
          </Link>
          <div className="text-xs text-muted-foreground">
            {new Date(e.starts_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            {e.location && ` · ${e.location}`}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {e.roles.map((r) => (
              <StatusBadge key={r} variant={ROLE_BADGE[r].variant}>{ROLE_BADGE[r].label}</StatusBadge>
            ))}
            {e.rsvp_status === "waitlist" && <StatusBadge variant="warning">Waitlist</StatusBadge>}
          </div>
        </div>

        <StatusBadge variant={STATUS_VARIANT[e.status]}>
          {ended && e.status === "published" ? "Ended" : e.status}
        </StatusBadge>

        {isHosting && (
          <div className="hidden text-right text-sm sm:block min-w-[5rem]">
            <div className="font-medium">{e.attending}/{e.capacity}</div>
            <div className="text-xs text-muted-foreground">{e.waitlist} waitlist</div>
          </div>
        )}

        <div className="flex items-center gap-1">
          {isHosting ? (
            <Button size="icon" variant="ghost" asChild title="Edit">
              <Link to={`/host/events/${e.id}/edit`}><Pencil className="h-4 w-4" /></Link>
            </Button>
          ) : e.roles.includes("attending") && e.rsvp_status === "going" && !ended ? (
            <Button size="icon" variant="ghost" asChild title="My ticket">
              <Link to="/tickets"><Ticket className="h-4 w-4" /></Link>
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" title="More"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isHosting && (
                <>
                  {e.status !== "published" ? (
                    <DropdownMenuItem onClick={() => setConfirm("publish")}>
                      <Eye className="mr-2 h-4 w-4" /> Publish
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => setConfirm("unpublish")}>
                      <EyeOff className="mr-2 h-4 w-4" /> Unpublish
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={exportCsv}>
                    <Download className="mr-2 h-4 w-4" /> Export RSVPs CSV
                  </DropdownMenuItem>
                </>
              )}
              {isCheckingOrHosting && !ended && (
                <DropdownMenuItem asChild>
                  <Link to={`/host/check-in?event=${e.id}`}><ScanLine className="mr-2 h-4 w-4" /> Check-in</Link>
                </DropdownMenuItem>
              )}
              {isHosting && (
                <DropdownMenuItem asChild>
                  <Link to="/host/gallery"><ImageIcon className="mr-2 h-4 w-4" /> Moderation</Link>
                </DropdownMenuItem>
              )}
              {e.roles.includes("attending") && e.rsvp_status === "going" && !ended && (
                <DropdownMenuItem asChild>
                  <Link to="/tickets"><Ticket className="mr-2 h-4 w-4" /> My ticket</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "publish" ? "Publish this event?" : "Unpublish this event?"}
        description={confirm === "publish" ? "It will appear in public listings and people can RSVP." : "It will be hidden from public listings. Existing RSVPs are kept."}
        confirmLabel={confirm === "publish" ? "Publish" : "Unpublish"}
        destructive={confirm === "unpublish"}
        onConfirm={() => setStatus(confirm === "publish" ? "published" : "draft")}
      />
    </>
  );
};

const HostMyEvents = () => {
  const { user, roles } = useAuth();
  const isHost = roles.includes("host");
  const isChecker = roles.includes("checker") || roles.includes("admin");

  const { events: hostedEvents, loading: hostLoading, refresh: refreshHost } = useHostData();
  const { rows: myRsvps, loading: rsvpLoading, refresh: refreshRsvps } = useMyRsvps();
  const [checkerEvents, setCheckerEvents] = useState<HostEventRow[]>([]);
  const [checkerLoading, setCheckerLoading] = useState(isChecker);

  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();

  useEffect(() => {
    if (!isChecker) { setCheckerLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title,starts_at,ends_at,location,cover_image_url,status,capacity")
        .eq("status", "published")
        .order("starts_at", { ascending: true });
      setCheckerEvents((data ?? []).map((e: any) => ({ ...e, attending: 0, waitlist: 0 })));
      setCheckerLoading(false);
    })();
  }, [isChecker, user?.id]);

  const refresh = () => { refreshHost(); refreshRsvps(); };

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
          capacity: e.capacity ?? 0,
          attending: e.attending ?? 0,
          waitlist: e.waitlist ?? 0,
          roles: [role], rsvp_status,
        });
      }
    };
    hostedEvents.forEach((e) => add(e, "hosting"));
    myRsvps.filter((r) => r.status !== "cancelled").forEach((r) => add(r.event, "attending", r.status));
    checkerEvents.forEach((e) => add(e, "checking"));
    return Array.from(map.values()).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  }, [hostedEvents, myRsvps, checkerEvents]);

  const counts = {
    all: merged.length,
    hosting: merged.filter((e) => e.roles.includes("hosting")).length,
    attending: merged.filter((e) => e.roles.includes("attending")).length,
    checking: merged.filter((e) => e.roles.includes("checking")).length,
  };

  const filtered = useMemo(() => {
    return merged.filter((e) => {
      if (roleFilter !== "all" && !e.roles.includes(roleFilter)) return false;
      if (q && !e.title.toLowerCase().includes(q.toLowerCase()) && !(e.location ?? "").toLowerCase().includes(q.toLowerCase())) return false;
      const start = new Date(e.starts_at).getTime();
      if (from && start < from.setHours(0, 0, 0, 0)) return false;
      if (to && start > new Date(to).setHours(23, 59, 59, 999)) return false;
      return true;
    });
  }, [merged, roleFilter, q, from, to]);

  const loading = hostLoading || rsvpLoading || checkerLoading;
  const clearDates = () => { setFrom(undefined); setTo(undefined); };
  const hasFilters = q || from || to || roleFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">My Events</h1>
          <p className="text-sm text-muted-foreground">All events you host, attend, or check in.</p>
        </div>
        {isHost && (
          <Button asChild className="bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95">
            <Link to="/host/events/new"><PlusCircle className="mr-2 h-4 w-4" /> New event</Link>
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : merged.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events yet"
          description="Create an event, RSVP to one, or get assigned as a checker."
          action={isHost ? <Button asChild className="bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95"><Link to="/host/events/new"><PlusCircle className="mr-2 h-4 w-4" /> Create event</Link></Button> : <Button asChild variant="outline"><Link to="/events">Browse events</Link></Button>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
                {counts.hosting > 0 && <TabsTrigger value="hosting">Hosting ({counts.hosting})</TabsTrigger>}
                {counts.attending > 0 && <TabsTrigger value="attending">Attending ({counts.attending})</TabsTrigger>}
                {counts.checking > 0 && <TabsTrigger value="checking">Checking ({counts.checking})</TabsTrigger>}
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or location..." className="w-64 pl-8" />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("font-normal", !from && !to && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {from && to ? `${format(from, "MMM d")} – ${format(to, "MMM d")}` : from ? `From ${format(from, "MMM d, yyyy")}` : to ? `Until ${format(to, "MMM d, yyyy")}` : "Date range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from, to }}
                  onSelect={(r: any) => { setFrom(r?.from); setTo(r?.to); }}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setQ(""); clearDates(); setRoleFilter("all"); }}>
                Clear
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No events match" description="Try adjusting your search or filters." />
          ) : (
            <Card className="divide-y divide-border shadow-soft">
              {filtered.map((e) => <Row key={e.id} e={e} onChange={refresh} />)}
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default HostMyEvents;
