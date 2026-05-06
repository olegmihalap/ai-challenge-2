import { memo } from "react";
import { Calendar, MapPin, Users, CheckCircle2, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import { CapacityIndicator } from "./CapacityIndicator";
import { isPastEvent, getCapacityStatus, capacityLabel } from "@/lib/event-helpers";
import type { EventWithMeta } from "@/hooks/useEvents";

const STATUS_VARIANT = {
  available: "success",
  almost_full: "warning",
  full: "destructive",
  waitlist: "warning",
  ended: "muted",
} as const;

const EventCardImpl = ({ event }: { event: EventWithMeta }) => {
  const date = new Date(event.starts_at);
  const ended = isPastEvent(event);
  const status = getCapacityStatus(event);
  const navigate = useNavigate();

  return (
    <Link to={`/events/${event.id}`} className="group block">
      <Card className="overflow-hidden border-border/60 bg-gradient-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated">
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {event.cover_image_url && (
            <img
              src={event.cover_image_url}
              alt={event.title}
              loading="lazy"
              className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${ended ? "grayscale-[40%]" : ""}`}
            />
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {event.category && <StatusBadge variant="accent">{event.category}</StatusBadge>}
            {event.is_free && !ended && <StatusBadge variant="success">Free</StatusBadge>}
            {!ended && <StatusBadge variant={STATUS_VARIANT[status]}>{capacityLabel[status]}</StatusBadge>}
          </div>
          {ended && (
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/40 backdrop-blur-[1px]">
              <span className="rounded-full bg-background/95 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-foreground shadow-soft">
                Ended
              </span>
            </div>
          )}
        </div>
        <div className="space-y-3 p-5">
          <div>
            <h3 className="font-display text-lg font-semibold leading-tight text-foreground line-clamp-2 group-hover:text-primary">
              {event.title}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              by{" "}
              {event.host_id ? (
                <span
                  role="link"
                  tabIndex={0}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/hosts/${event.host_id}`); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); navigate(`/hosts/${event.host_id}`); } }}
                  className="font-medium text-foreground hover:text-primary hover:underline cursor-pointer"
                >
                  {event.host_name}
                </span>
              ) : (
                <span className="font-medium text-foreground">{event.host_name}</span>
              )}
              {event.host_verified && <CheckCircle2 className="h-3 w-3 text-primary" />}
            </p>
          </div>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /><span>{date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span></div>
            <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /><span className="truncate">{event.location}</span></div>
            <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /><span>{event.attending} / {event.capacity} attending</span></div>
          </div>
          <CapacityIndicator current={event.attending} capacity={event.capacity} />
        </div>
      </Card>
    </Link>
  );
};

export const EventCard = memo(EventCardImpl, (a, b) =>
  a.event.id === b.event.id &&
  a.event.attending === b.event.attending &&
  a.event.waitlist_count === b.event.waitlist_count &&
  a.event.status === b.event.status
);
