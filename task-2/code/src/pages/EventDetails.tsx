import { Link, useParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, MapPin, Users, ArrowLeft, Share2, ShieldCheck, CheckCircle2, Pencil } from "lucide-react";
import { PublicGallery } from "@/components/gallery/PublicGallery";
import { GalleryUploader } from "@/components/gallery/GalleryUploader";
import { EventFeedback } from "@/components/feedback/EventFeedback";
import { useAuth } from "@/contexts/AuthContext";
import { ReportDialog } from "@/components/moderation/ReportDialog";
import { StatusBadge } from "@/components/event/StatusBadge";
import { CapacityIndicator } from "@/components/event/CapacityIndicator";
import { WaitlistBadge } from "@/components/event/WaitlistBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEvent, useMyRsvp } from "@/hooks/useEvents";
import { isPastEvent, getCapacityStatus, capacityLabel } from "@/lib/event-helpers";
import { RSVPButton } from "@/components/event/RSVPButton";
import { SEO } from "@/components/common/SEO";

const STATUS_VARIANT = {
  available: "success",
  almost_full: "warning",
  full: "destructive",
  waitlist: "warning",
  ended: "muted",
} as const;

const EventDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { event, loading, refresh: refreshEvent } = useEvent(id);
  const { rsvp, position, refresh } = useMyRsvp(id);
  const reload = () => { refresh(); refreshEvent(); };
  const isOwner = !!user && !!event && event.host_id === user.id;

  if (loading) return <LoadingState label="Loading event..." />;
  if (event && event.status === "draft") return <Navigate to="/events" replace />;
  if (!event) {
    return (
      <div className="container py-16">
        <EmptyState title="Event not found" description="This event may have been removed or never existed." action={<Button asChild><Link to="/events">Browse events</Link></Button>} />
      </div>
    );
  }

  const ended = isPastEvent(event);
  const status = getCapacityStatus(event);
  const date = new Date(event.starts_at);

  const descSrc = (event.description ?? "").replace(/\s+/g, " ").trim();
  const seoDesc = descSrc ? descSrc.slice(0, 155) : `${event.title} on ${date.toLocaleString()} at ${event.location ?? "TBA"}.`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.starts_at,
    endDate: event.ends_at ?? undefined,
    eventStatus: ended ? "https://schema.org/EventScheduled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: event.location ? { "@type": "Place", name: event.location } : undefined,
    image: event.cover_image_url ? [event.cover_image_url] : undefined,
    description: seoDesc,
    organizer: { "@type": "Organization", name: event.host_name },
    offers: event.is_free ? { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" } : undefined,
  };

  return (
    <div className="container py-8 md:py-12">
      <SEO
        title={`${event.title} · Gather`}
        description={seoDesc}
        image={event.cover_image_url ?? undefined}
        type="article"
        jsonLd={jsonLd}
      />
      <Link to="/events" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div className="relative overflow-hidden rounded-2xl shadow-soft">
            {event.cover_image_url && <img src={event.cover_image_url} alt={event.title} className={`aspect-[16/9] w-full object-cover ${ended ? "grayscale-[30%]" : ""}`} />}
            {ended && (
              <div className="absolute inset-0 flex items-center justify-center bg-foreground/45">
                <span className="rounded-full bg-background/95 px-6 py-2 font-display text-base font-bold uppercase tracking-widest text-foreground shadow-elevated">Event ended</span>
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              {event.category && <StatusBadge variant="accent">{event.category}</StatusBadge>}
              {event.is_free && !ended && <StatusBadge variant="success">Free</StatusBadge>}
              {!ended && <StatusBadge variant={STATUS_VARIANT[status]}>{capacityLabel[status]}</StatusBadge>}
              {event.host_verified && <StatusBadge variant="success"><ShieldCheck className="mr-1 inline h-3 w-3" />Verified host</StatusBadge>}
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <h1 className="font-display text-3xl font-bold leading-tight text-balance md:text-4xl">{event.title}</h1>
              {user && event.host_id === user.id && (
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link to={`/host/events/${event.id}/edit`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link>
                </Button>
              )}
            </div>
          </div>

          <Link to={event.host_id ? `/hosts/${event.host_id}` : "#"} className="block">
            <Card className="flex items-center gap-4 p-4 shadow-soft transition-colors hover:bg-muted/40">
              <Avatar className="h-12 w-12">
                {event.host_avatar_url && <AvatarImage src={event.host_avatar_url} alt={event.host_name} />}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">{event.host_name.slice(0,2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-semibold">{event.host_name}</span>
                  {event.host_verified && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-sm text-muted-foreground">View host profile →</p>
              </div>
            </Card>
          </Link>

          <section>
            <h2 className="font-display text-xl font-semibold">About this event</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground whitespace-pre-line">{event.description}</p>
          </section>

          <section>
            <h2 className="mb-3 font-display text-xl font-semibold">Gallery</h2>
            <PublicGallery eventId={event.id} />
            {!isOwner && (
              <div className="mt-4">
                <GalleryUploader
                  eventId={event.id}
                  canUpload={!!user && rsvp?.status === "going"}
                  reason={!user ? "auth" : "rsvp"}
                />
              </div>
            )}
          </section>

          <EventFeedback
            eventId={event.id}
            ended={ended}
            isAttendee={!isOwner && rsvp?.status === "going"}
            isHost={isOwner}
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="space-y-5 bg-gradient-card p-6 shadow-soft">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium text-foreground">{date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
                  <div className="text-muted-foreground">{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div className="text-foreground">{event.location}</div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-4 w-4 text-primary" />
                <div className="flex-1">
                  <div className="text-foreground">
                    {event.attending} attending
                    {!ended && status !== "full" && status !== "waitlist" && (
                      <span className="text-muted-foreground"> · {Math.max(0, event.capacity - event.attending)} spots left</span>
                    )}
                    {!ended && (status === "full" || status === "waitlist") && (
                      <span className="text-warning"> · Full {event.waitlist_count > 0 && `· ${event.waitlist_count} on waitlist`}</span>
                    )}
                  </div>
                  <CapacityIndicator current={event.attending} capacity={event.capacity} showLabel className="mt-2" />
                </div>
              </div>
            </div>

            {isOwner ? (
              <div className="space-y-2">
                <Button asChild className="w-full bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95">
                  <Link to={`/host/events/${event.id}/edit`}><Pencil className="mr-2 h-4 w-4" /> Edit event</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/host/events">Manage events</Link>
                </Button>
              </div>
            ) : ended ? (
              <div className="rounded-lg bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
                This event has ended. Browse <Link to="/events" className="font-medium text-primary hover:underline">upcoming events</Link>.
              </div>
            ) : (
              <RSVPButton event={event} rsvp={rsvp} position={position} onChange={reload} />
            )}
            <Button variant="outline" className="w-full" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}>
              <Share2 className="mr-2 h-4 w-4" /> Share event
            </Button>
            {user && !isOwner && (
              <ReportDialog
                target={{ kind: "event", id: event.id }}
                trigger={<Button variant="ghost" size="sm" className="w-full text-muted-foreground">Report this event</Button>}
              />
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default EventDetails;
