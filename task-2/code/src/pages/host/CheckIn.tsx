import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanLine, CheckCircle2, AlertTriangle, XCircle, Undo2, Camera, Keyboard, CalendarDays, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHostData } from "@/hooks/useHostData";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QrScanner } from "@/components/event/QrScanner";
import { cn } from "@/lib/utils";
import { LoadingState } from "@/components/common/LoadingState";

type ScanStatus = "ok" | "duplicate" | "cancelled" | "waitlist" | "wrong_event" | "invalid";

interface ScanResult {
  status: ScanStatus;
  rsvp_id?: string;
  name?: string | null;
  checked_in_at?: string;
  check_in_id?: string;
  code: string;
}

interface RecentEntry {
  check_in_id: string;
  name: string | null;
  code: string;
  at: string;
}

const STATUS_META: Record<ScanStatus, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  ok: { label: "Checked in", tone: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
  duplicate: { label: "Already checked in", tone: "bg-warning/10 text-warning border-warning/30", icon: AlertTriangle },
  cancelled: { label: "RSVP cancelled", tone: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  waitlist: { label: "On waitlist — not confirmed", tone: "bg-warning/10 text-warning border-warning/30", icon: AlertTriangle },
  wrong_event: { label: "Ticket is for another event", tone: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  invalid: { label: "Invalid ticket code", tone: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
};

const CheckIn = () => {
  const { events, loading: hostLoading } = useHostData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [eventId, setEventId] = useState<string>(searchParams.get("event") ?? "");
  const [code, setCode] = useState("");
  const [last, setLast] = useState<ScanResult | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [counts, setCounts] = useState({ checked: 0, going: 0, waitlist: 0 });
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [scanTab, setScanTab] = useState<string>("scan");
  const inFlight = useRef(false);

  const selectableEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((e) => {
      if (e.status !== "published") return false;
      const end = new Date((e as any).ends_at ?? e.starts_at).getTime();
      return end >= now;
    });
  }, [events]);

  // No auto-select: user must pick an event from the list

  const refreshCounters = async (id: string) => {
    const [rsvpRes, ciRes] = await Promise.all([
      supabase.from("rsvps").select("status").eq("event_id", id),
      supabase.from("check_ins").select("id,checked_in_at,rsvp_id", { count: "exact" }).eq("event_id", id),
    ]);
    const going = (rsvpRes.data ?? []).filter((r: any) => r.status === "going").length;
    const waitlist = (rsvpRes.data ?? []).filter((r: any) => r.status === "waitlist").length;
    setCounts({ checked: ciRes.count ?? 0, going, waitlist });
  };

  const refreshRecent = async (id: string) => {
    const { data } = await supabase
      .from("check_ins")
      .select("id,checked_in_at,rsvp_id,rsvps!inner(qr_code,user_id)")
      .eq("event_id", id)
      .order("checked_in_at", { ascending: false })
      .limit(10);
    const rows = (data ?? []) as any[];
    const userIds = Array.from(new Set(rows.map((r) => r.rsvps?.user_id).filter(Boolean)));
    const nameMap: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", userIds);
      profs?.forEach((p: any) => { nameMap[p.id] = p.display_name; });
    }
    const mapped: RecentEntry[] = rows.map((r) => ({
      check_in_id: r.id,
      at: r.checked_in_at,
      code: r.rsvps?.qr_code ?? "",
      name: r.rsvps?.user_id ? nameMap[r.rsvps.user_id] ?? null : null,
    }));
    setRecent(mapped);
  };

  useEffect(() => {
    if (!eventId) return;
    refreshCounters(eventId);
    refreshRecent(eventId);
    const ch = supabase
      .channel(`checkins-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "check_ins", filter: `event_id=eq.${eventId}` }, () => {
        refreshCounters(eventId);
        refreshRecent(eventId);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId]);

  const handleScan = async (raw: string) => {
    if (!eventId || inFlight.current) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("checkin_scan", { _event_id: eventId, _code: trimmed });
      if (error) throw error;
      const result = { ...(data as any), code: trimmed } as ScanResult;
      setLast(result);
      setPulse((p) => p + 1);
      const meta = STATUS_META[result.status];
      if (result.status === "ok") toast.success(`✓ ${result.name ?? "Attendee"} checked in`);
      else if (result.status === "duplicate") toast.warning(`Already checked in${result.name ? ` — ${result.name}` : ""}`);
      else toast.error(meta.label);
      if (result.status === "ok") {
        refreshCounters(eventId);
        refreshRecent(eventId);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Scan failed");
    } finally {
      setBusy(false);
      setTimeout(() => { inFlight.current = false; }, 400);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    handleScan(code);
    setCode("");
  };

  const undoLast = async () => {
    if (!last || last.status !== "ok" || !last.check_in_id) return;
    const id = last.check_in_id;
    const { error } = await supabase.rpc("checkin_undo", { _check_in_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Undid last check-in");
    setLast(null);
    if (eventId) { refreshCounters(eventId); refreshRecent(eventId); }
  };

  if (hostLoading) return <LoadingState />;

  if (!selectableEvents.length) {
    return (
      <Card className="p-8 text-center shadow-soft">
        <ScanLine className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-3 font-display text-xl font-semibold">No published events</h2>
        <p className="mt-1 text-sm text-muted-foreground">Publish an event to begin checking in attendees.</p>
      </Card>
    );
  }

  const selected = selectableEvents.find((e) => e.id === eventId);
  const remaining = Math.max(0, counts.going - counts.checked);
  const meta = last ? STATUS_META[last.status] : null;
  const Icon = meta?.icon;

  if (!eventId) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Check-In</h1>
          <p className="text-sm text-muted-foreground">Select an event to start checking in attendees.</p>
        </div>
        <div className="flex flex-col gap-3">
          {selectableEvents.map((e) => (
            <button
              key={e.id}
              onClick={() => { setEventId(e.id); setSearchParams({ event: e.id }); }}
              className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-3 text-left shadow-soft transition-colors hover:bg-accent"
            >
              <div className="h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                {(e as any).cover_image_url ? (
                  <img src={(e as any).cover_image_url} alt={e.title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-base font-semibold">{e.title}</div>
                <div className="truncate text-xs text-muted-foreground">{new Date(e.starts_at).toLocaleString()}</div>
              </div>
              <ScanLine className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Check-In</h1>
          <p className="text-sm text-muted-foreground">Scan or enter ticket codes at the door.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setEventId(""); setLast(null); setSearchParams({}); }} className="gap-1.5 md:self-end">
          <ArrowLeft className="h-4 w-4" /> Change event
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Checked in" value={counts.checked} tone="text-success" />
        <StatCard label="Remaining" value={remaining} />
        <StatCard label="Total RSVPs" value={counts.going} />
        <StatCard label="Waitlist" value={counts.waitlist} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="bg-gradient-card p-5 shadow-soft">
          {selected && (
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ScanLine className="h-5 w-5" /></div>
              <div className="min-w-0">
                <div className="truncate font-display text-base font-semibold">{selected.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(selected.starts_at).toLocaleString()}</div>
              </div>
            </div>
          )}

          <Tabs defaultValue="scan" onValueChange={(v) => setScanTab(v)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="scan"><Camera className="mr-1.5 h-4 w-4" />Scan QR</TabsTrigger>
              <TabsTrigger value="manual"><Keyboard className="mr-1.5 h-4 w-4" />Manual</TabsTrigger>
            </TabsList>
            <TabsContent value="scan" className="mt-4">
              <div className="overflow-hidden rounded-xl border border-border/60">
                {scanTab === "scan" && <QrScanner onScan={handleScan} paused={busy} />}
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">Point the camera at an attendee's QR code.</p>
            </TabsContent>
            <TabsContent value="manual" className="mt-4">
              <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste or enter ticket code" autoFocus className="font-mono" />
                <Button type="submit" disabled={busy || !code.trim()}>Check in</Button>
              </form>
            </TabsContent>
          </Tabs>

          {last && meta && Icon && (
            <div
              key={pulse}
              className={cn(
                "mt-5 rounded-xl border p-4 transition-all animate-in fade-in zoom-in-95 duration-300",
                meta.tone
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-6 w-6 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold">{meta.label}</div>
                  {last.name && <div className="text-sm">{last.name}</div>}
                  <div className="mt-0.5 truncate font-mono text-xs opacity-80">{last.code}</div>
                  {last.checked_in_at && (
                    <div className="text-xs opacity-80">{new Date(last.checked_in_at).toLocaleTimeString()}</div>
                  )}
                </div>
                {last.status === "ok" && (
                  <Button size="sm" variant="outline" onClick={undoLast} className="gap-1.5">
                    <Undo2 className="h-3.5 w-3.5" /> Undo
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 shadow-soft">
          <h2 className="font-display text-base font-semibold">Recent check-ins</h2>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No check-ins yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {recent.map((r) => (
                <div key={r.check_in_id} className="flex items-center gap-3 py-3">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.name ?? "Attendee"}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{r.code.slice(0, 12)}…</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
  <Card className="p-4 shadow-soft">
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={cn("mt-1 font-display text-2xl font-bold tabular-nums", tone)}>{value}</div>
  </Card>
);

export default CheckIn;
