import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type { EventWithMeta, UserRsvp } from "@/hooks/useEvents";
import { isPastEvent } from "@/lib/event-helpers";
import { Check, Clock, LogIn, Ticket } from "lucide-react";

export const RSVPButton = ({
  event,
  rsvp,
  position = 0,
  onChange,
  size = "lg",
}: {
  event: EventWithMeta;
  rsvp: UserRsvp | null;
  position?: number;
  onChange: () => void;
  size?: "default" | "lg" | "sm";
}) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const ended = isPastEvent(event);
  const isFull = event.attending >= event.capacity;
  const going = rsvp && rsvp.status !== "cancelled";

  if (ended) return null;

  const handleRsvp = async () => {
    if (!user) { setAuthOpen(true); return; }
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("rsvp_register", { _event_id: event.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.rsvp_status === "waitlist") {
      toast.success(`You're on the waitlist${row.queue_position ? ` — position #${row.queue_position}` : ""}.`);
    } else {
      toast.success("You're going! Ticket added to My Tickets.");
    }
    onChange();
  };

  const handleCancel = async () => {
    if (!rsvp) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("rsvp_cancel", { _rsvp_id: rsvp.id });
    setBusy(false);
    setCancelOpen(false);
    if (error) return toast.error(error.message);
    if (data) toast.success("RSVP cancelled. A waitlisted attendee was promoted.");
    else toast("RSVP cancelled.");
    onChange();
  };

  if (going) {
    const onWaitlist = rsvp.status === "waitlist";
    return (
      <>
        <div className="space-y-2">
          <div className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${onWaitlist ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
            {onWaitlist ? <Clock className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {onWaitlist
              ? `On waitlist${position ? ` — position #${position}` : ""}`
              : "You're going"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" asChild>
              <Link to="/tickets"><Ticket className="mr-2 h-4 w-4" /> View ticket</Link>
            </Button>
            <Button variant="ghost" className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setCancelOpen(true)}>
              {onWaitlist ? "Leave waitlist" : "Cancel RSVP"}
            </Button>
          </div>
        </div>
        <ConfirmDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          title={onWaitlist ? "Leave the waitlist?" : "Cancel your RSVP?"}
          description={onWaitlist ? "You'll lose your queue position." : "Your spot will be released and offered to the next person on the waitlist."}
          confirmLabel={onWaitlist ? "Leave waitlist" : "Cancel RSVP"}
          destructive
          onConfirm={handleCancel}
        />
      </>
    );
  }

  return (
    <>
      <Button onClick={handleRsvp} disabled={busy} size={size} className="w-full bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95">
        {busy ? "Saving..." : isFull ? "Join Waitlist" : "RSVP — Get Ticket"}
      </Button>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><LogIn className="h-5 w-5 text-primary" /> Sign in to RSVP</DialogTitle>
            <DialogDescription>Create a free account or sign in to reserve your spot for <span className="font-medium text-foreground">{event.title}</span>.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="w-full bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95" onClick={() => nav(`/sign-in?redirect=${encodeURIComponent(loc.pathname)}`)}>
              Sign in
            </Button>
            <Button variant="outline" className="w-full" onClick={() => nav(`/sign-up?redirect=${encodeURIComponent(loc.pathname)}`)}>
              Create an account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
