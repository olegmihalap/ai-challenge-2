import { Card } from "@/components/ui/card";
import { CalendarDays, Users, Ticket, Clock, Image as ImageIcon, Flag, ArrowUpRight, PlusCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/event/StatusBadge";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { useHostData } from "@/hooks/useHostData";
import { useAuth } from "@/contexts/AuthContext";
import { isPastEvent } from "@/lib/event-helpers";

const HostDashboard = () => {
  const { user } = useAuth();
  const { events, stats, loading } = useHostData();

  if (loading || !stats) return <LoadingState label="Loading your dashboard..." />;

  const upcoming = events
    .filter((e) => e.status === "published" && !isPastEvent(e))
    .slice(0, 5);
  const drafts = events.filter((e) => e.status === "draft").slice(0, 5);

  const widgets = [
    { label: "Total events", value: stats.totalEvents, icon: CalendarDays, tone: "text-primary bg-primary/10" },
    { label: "Total RSVPs", value: stats.totalRsvps, icon: Users, tone: "text-success bg-success/10" },
    { label: "Upcoming", value: stats.upcomingEvents, icon: Ticket, tone: "text-accent-foreground bg-accent" },
    { label: "On waitlist", value: stats.totalWaitlist, icon: Clock, tone: "text-warning bg-warning/10" },
    { label: "Pending photos", value: stats.pendingGallery, icon: ImageIcon, tone: "text-primary bg-primary/10" },
    { label: "Open reports", value: stats.openReports, icon: Flag, tone: "text-destructive bg-destructive/10" },
  ];

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Host Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome{user?.email ? `, ${user.email.split("@")[0]}` : ""}.</p>
        </div>
        <Card className="bg-gradient-card p-8 text-center shadow-soft">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold">Let's create your first event</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Set the title, date, location, and capacity. You can save as a draft and publish when you're ready.
          </p>
          <Button asChild className="mt-5 bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95">
            <Link to="/host/events/new"><PlusCircle className="mr-2 h-4 w-4" /> Create event</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Host Dashboard</h1>
          <p className="text-sm text-muted-foreground">An overview of your community.</p>
        </div>
        <Button asChild className="bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95">
          <Link to="/host/events/new"><PlusCircle className="mr-2 h-4 w-4" /> Create event</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {widgets.map((w) => (
          <Card key={w.label} className="bg-gradient-card p-5 shadow-soft">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${w.tone}`}>
              <w.icon className="h-4 w-4" />
            </div>
            <div className="mt-4 font-display text-2xl font-bold">{w.value}</div>
            <div className="text-xs text-muted-foreground">{w.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Upcoming events</h2>
            <Link to="/host/events" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No upcoming published events.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {upcoming.map((e) => (
                <Link key={e.id} to={`/host/events/${e.id}/edit`} className="flex items-center gap-4 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg">
                  {e.cover_image_url && <img src={e.cover_image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(e.starts_at).toLocaleDateString()} · {e.attending}/{e.capacity} attending
                      {e.waitlist > 0 && ` · ${e.waitlist} waitlist`}
                    </div>
                  </div>
                  <StatusBadge variant="success">Published</StatusBadge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Drafts</h2>
            <Link to="/host/events" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {drafts.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No drafts" description="Save events as drafts to finish later." />
          ) : (
            <div className="mt-4 divide-y divide-border">
              {drafts.map((e) => (
                <Link key={e.id} to={`/host/events/${e.id}/edit`} className="flex items-center gap-4 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg">
                  {e.cover_image_url && <img src={e.cover_image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(e.starts_at).toLocaleDateString()}</div>
                  </div>
                  <StatusBadge variant="muted">Draft</StatusBadge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default HostDashboard;
