import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Sparkles, ShieldCheck, Users } from "lucide-react";
import hero from "@/assets/hero-event.jpg";
import { EventCard } from "@/components/event/EventCard";
import { useEvents } from "@/hooks/useEvents";
import { isPastEvent } from "@/lib/event-helpers";
import { useAuth } from "@/contexts/AuthContext";

const Home = () => {
  const { events } = useEvents();
  const { user, roles } = useAuth();
  const isHost = roles.includes("host") || roles.includes("admin");
  const becomeHostTo = !user ? "/sign-in" : isHost ? "/host" : "/become-host";
  const featured = events.filter((e) => !isPastEvent(e)).slice(0, 6);
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-soft">
        <div className="container grid gap-10 py-16 md:grid-cols-2 md:py-24 lg:gap-16">
          <div className="flex flex-col justify-center animate-fade-in">
            <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <Sparkles className="h-3 w-3 text-primary" /> Built for community organizers
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-balance md:text-6xl">
              Find your people. <span className="bg-gradient-hero bg-clip-text text-transparent">Host the moments.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
              Discover local events, RSVP in seconds, and run gatherings your community will remember — all from one beautifully simple platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild className="bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95">
                <Link to="/events">Browse Events <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to={becomeHostTo}>{isHost ? "Open host dashboard" : "Become a host"}</Link>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              {[
                { icon: Calendar, label: "Events live", value: "1.2k" },
                { icon: Users, label: "RSVPs / mo", value: "48k" },
                { icon: ShieldCheck, label: "Hosts verified", value: "320+" },
              ].map((s) => (
                <div key={s.label}>
                  <s.icon className="mb-1 h-4 w-4 text-primary" />
                  <div className="font-display text-xl font-semibold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative animate-scale-in">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-hero opacity-20 blur-2xl" />
            <img src={hero} alt="Community event at twilight with lanterns" width={1600} height={1024} className="relative aspect-[4/3] w-full rounded-2xl object-cover shadow-elevated" />
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="container py-16 md:py-24">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold md:text-3xl">Trending this week</h2>
            <p className="mt-1 text-sm text-muted-foreground">Hand-picked events your neighbors are talking about.</p>
          </div>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link to="/events">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      </section>

      {/* CTA */}
      {!isHost && (
      <section className="container pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-10 text-primary-foreground shadow-elevated md:p-16">
          <div className="relative z-10 max-w-2xl">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Host your first event in minutes.</h2>
            <p className="mt-3 text-primary-foreground/85 md:text-lg">RSVPs, ticketing, check-ins, and a moderated photo gallery — everything you need, nothing you don't.</p>
            <Button size="lg" variant="secondary" asChild className="mt-6">
              <Link to="/sign-up">Start hosting <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        </div>
      </section>
      )}
    </div>
  );
};

export default Home;
