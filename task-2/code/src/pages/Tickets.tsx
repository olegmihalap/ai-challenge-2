import { useMemo, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { Ticket, Calendar, MapPin, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useMyRsvps } from "@/hooks/useEvents";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/event/StatusBadge";
import { downloadIcs, googleCalendarUrl } from "@/lib/calendar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isPastEvent } from "@/lib/event-helpers";

const TicketCard = ({ row, onChange }: { row: any; onChange: () => void }) => {
  const e = row.event;
  const date = new Date(e.starts_at);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(row.qr_code)}`;
  const [open, setOpen] = useState(false);

  const cancel = async () => {
    const { data, error } = await (supabase as any).rpc("rsvp_cancel", { _rsvp_id: row.id });
    setOpen(false);
    if (error) return toast.error(error.message);
    if (data) toast.success("RSVP cancelled. A waitlisted attendee was promoted.");
    else toast("RSVP cancelled.");
    onChange();
  };

  return (
    <Card className="overflow-hidden bg-gradient-card shadow-soft">
      <div className="flex flex-col sm:flex-row">
        <div className="flex flex-col items-center justify-center gap-2 border-b border-dashed border-border bg-background/60 p-5 sm:border-b-0 sm:border-r">
          <div className="rounded-lg bg-white p-2 shadow-soft">
            <img src={qrUrl} alt={`QR for ${e.title}`} className="h-36 w-36" />
          </div>
          <button
            className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => { navigator.clipboard.writeText(row.qr_code); toast.success("Code copied"); }}
          >
            <Copy className="h-3 w-3" /> {row.qr_code.slice(0, 12)}…
          </button>
        </div>
        <div className="flex-1 space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/events/${e.id}`} className="font-display text-lg font-semibold leading-tight hover:text-primary">{e.title}</Link>
            <StatusBadge variant={row.status === "waitlist" ? "warning" : "success"}>{row.status === "waitlist" ? "Waitlist" : "Confirmed"}</StatusBadge>
          </div>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />{date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</div>
            <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /><span className="truncate">{e.location}</span></div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="outline" asChild>
              <a href={googleCalendarUrl(e)} target="_blank" rel="noreferrer"><Calendar className="mr-1 h-3.5 w-3.5" /> Google</a>
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadIcs(e)}><Download className="mr-1 h-3.5 w-3.5" /> iCal</Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setOpen(true)}>
              Cancel RSVP
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog open={open} onOpenChange={setOpen} title="Cancel your RSVP?" description="Your spot will be released." confirmLabel="Cancel RSVP" destructive onConfirm={cancel} />
    </Card>
  );
};

const Tickets = () => {
  const { rows, loading, refresh } = useMyRsvps();

  const { upcoming, past } = useMemo(() => {
    const active = rows.filter((r) => r.status !== "cancelled");
    return {
      upcoming: active.filter((r) => !isPastEvent(r.event)),
      past: active.filter((r) => isPastEvent(r.event)),
    };
  }, [rows]);

  return (
    <div className="container py-10 md:py-14">
      <h1 className="font-display text-3xl font-bold md:text-4xl">My Tickets</h1>
      <p className="mt-1 text-muted-foreground">Your QR passes for upcoming events.</p>

      <Tabs defaultValue="upcoming" className="mt-8">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-6">
          {loading ? <LoadingState /> : upcoming.length === 0 ? (
            <EmptyState icon={Ticket} title="No upcoming tickets" description="RSVP to an event and your pass will appear here." action={<Button asChild><Link to="/events">Browse events</Link></Button>} />
          ) : (
            <div className="space-y-4">
              {upcoming.map((r) => <TicketCard key={r.id} row={r} onChange={refresh} />)}
            </div>
          )}
        </TabsContent>
        <TabsContent value="past" className="mt-6">
          {loading ? <LoadingState /> : past.length === 0 ? (
            <EmptyState icon={Ticket} title="No past tickets" />
          ) : (
            <div className="space-y-4">
              {past.map((r) => <TicketCard key={r.id} row={r} onChange={refresh} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Tickets;
