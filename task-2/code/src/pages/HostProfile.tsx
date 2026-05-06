import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Globe, Building2, User } from "lucide-react";
import { EventCard } from "@/components/event/EventCard";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import type { EventWithMeta, DbEvent } from "@/hooks/useEvents";
import { SEO } from "@/components/common/SEO";

interface Profile { id: string; display_name: string | null; avatar_url: string | null; bio: string | null }
interface HostProfileRow { id: string; org_name: string; description: string | null; website: string | null; verified: boolean }

const HostProfile = () => {
  const { id } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [host, setHost] = useState<HostProfileRow | null>(null);
  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: pf }, { data: hp }, { data: evs }] = await Promise.all([
        supabase.from("profiles").select("id,display_name,avatar_url,bio").eq("id", id).maybeSingle(),
        supabase.from("host_profiles").select("id,org_name,description,website,verified").eq("id", id).maybeSingle(),
        supabase.from("events").select("*").eq("host_id", id).eq("status", "published").eq("visibility", "public").order("starts_at", { ascending: false }),
      ]);
      if (!active) return;
      setProfile(pf as any);
      setHost(hp as any);

      const eventList = (evs ?? []) as DbEvent[];
      const ids = eventList.map((e) => e.id);
      const going: Record<string, number> = {};
      const wait: Record<string, number> = {};
      if (ids.length) {
        const { data: rsvps } = await supabase.from("rsvps").select("event_id,status").in("event_id", ids).in("status", ["going", "waitlist"]);
        rsvps?.forEach((r: any) => {
          const b = r.status === "going" ? going : wait;
          b[r.event_id] = (b[r.event_id] ?? 0) + 1;
        });
      }
      const hostName = (hp as any)?.org_name ?? (pf as any)?.display_name ?? "Host";
      const verified = !!(hp as any)?.verified;
      setEvents(eventList.map((e) => ({
        ...e,
        attending: going[e.id] ?? 0,
        waitlist_count: wait[e.id] ?? 0,
        is_free: e.is_free ?? true,
        host_name: hostName,
        host_verified: verified,
      })));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) return <LoadingState />;
  if (!profile && !host) {
    return (
      <div className="container py-16">
        <EmptyState title="Host not found" description="This host profile doesn't exist or isn't available." />
      </div>
    );
  }

  const displayName = profile?.display_name ?? host?.org_name ?? "Host";
  const initials = (displayName ?? "H").slice(0, 2).toUpperCase();

  const seoDesc = (host?.description || profile?.bio || `Events hosted by ${displayName} on Gather.`).replace(/\s+/g, " ").trim().slice(0, 155);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: displayName,
    description: seoDesc,
    url: host?.website ?? undefined,
    image: profile?.avatar_url ?? undefined,
  };

  return (
    <div className="container space-y-8 py-10">
      <SEO
        title={`${displayName} · Host on Gather`}
        description={seoDesc}
        image={profile?.avatar_url ?? undefined}
        type="profile"
        jsonLd={jsonLd}
      />
      <Card className="overflow-hidden border-border/60 bg-gradient-card p-6 shadow-soft md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <Avatar className="h-24 w-24 shrink-0">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold md:text-3xl">{displayName}</h1>
                {host?.verified && <CheckCircle2 className="h-5 w-5 text-primary" aria-label="Verified" />}
              </div>
              {host?.org_name && profile?.display_name && host.org_name !== profile.display_name && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /> {host.org_name}
                </p>
              )}
              {host?.website && (
                <a
                  href={host.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" /> {host.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>

            {profile?.bio && (
              <div>
                <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <User className="h-3.5 w-3.5" /> About host
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{profile.bio}</p>
              </div>
            )}

            {host?.description && (
              <div>
                <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Building2 className="h-3.5 w-3.5" /> About company
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{host.description}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Events by {displayName}</h2>
        {events.length === 0 ? (
          <EmptyState title="No events yet" description="This host hasn't published any events." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </section>
    </div>
  );
};

export default HostProfile;
