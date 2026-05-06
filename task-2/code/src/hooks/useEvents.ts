import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DbEvent {
  id: string;
  host_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number;
  cover_image_url: string | null;
  status: "draft" | "published" | "cancelled" | "completed";
  visibility?: "public" | "unlisted";
  timezone?: string | null;
  organizer_contact?: string | null;
  is_free?: boolean;
}

export interface EventWithMeta extends DbEvent {
  attending: number;
  waitlist_count: number;
  is_free: boolean;
  host_name: string;
  host_verified: boolean;
  host_avatar_url?: string | null;
}

const enrich = (e: DbEvent, count: number, waitlist = 0, hostName?: string, hostVerified?: boolean, hostAvatarUrl?: string | null): EventWithMeta => ({
  ...e,
  attending: count,
  waitlist_count: waitlist,
  is_free: e.is_free ?? true,
  host_name: hostName ?? (e.host_id ? "Community Host" : "Gather Community"),
  host_verified: hostVerified ?? !e.host_id,
  host_avatar_url: hostAvatarUrl ?? null,
});

export const useEvents = () => {
  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "published")
        .eq("visibility", "public")
        .order("starts_at", { ascending: true });
      if (!active) return;
      if (error) { setError(error.message); setLoading(false); return; }
      const ids = (data ?? []).map((e: any) => e.id);
      const hostIds = Array.from(new Set((data ?? []).map((e: any) => e.host_id).filter(Boolean)));
      const going: Record<string, number> = {};
      const waitlist: Record<string, number> = {};
      const hostNames: Record<string, string> = {};
      const hostVerified: Record<string, boolean> = {};
      const hostAvatars: Record<string, string | null> = {};
      if (ids.length) {
        const { data: rsvps } = await supabase.from("rsvps").select("event_id,status").in("event_id", ids).in("status", ["going", "waitlist"]);
        rsvps?.forEach((r: any) => {
          const bucket = r.status === "going" ? going : waitlist;
          bucket[r.event_id] = (bucket[r.event_id] ?? 0) + 1;
        });
      }
      if (hostIds.length) {
        const [{ data: hp }, { data: pf }] = await Promise.all([
          supabase.from("host_profiles").select("id,org_name,verified").in("id", hostIds as string[]),
          supabase.from("profiles").select("id,display_name,avatar_url").in("id", hostIds as string[]),
        ]);
        hp?.forEach((h: any) => { hostNames[h.id] = h.org_name; hostVerified[h.id] = !!h.verified; });
        pf?.forEach((p: any) => {
          if (!hostNames[p.id] && p.display_name) hostNames[p.id] = p.display_name;
          hostAvatars[p.id] = p.avatar_url ?? null;
        });
      }
      setEvents((data ?? []).map((e: any) => enrich(e as DbEvent, going[e.id] ?? 0, waitlist[e.id] ?? 0, e.host_id ? hostNames[e.host_id] : undefined, e.host_id ? hostVerified[e.host_id] : undefined, e.host_id ? hostAvatars[e.host_id] : undefined)));
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return { events, loading, error };
};

export const useEvent = (id: string | undefined) => {
  const [event, setEvent] = useState<EventWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    if (error) { setError(error.message); setLoading(false); return; }
    if (!data) { setEvent(null); setLoading(false); return; }
    const ev = data as DbEvent;
    const [{ count: going }, { count: waitlist }, hostInfo] = await Promise.all([
      supabase.from("rsvps").select("*", { count: "exact", head: true }).eq("event_id", id).eq("status", "going"),
      supabase.from("rsvps").select("*", { count: "exact", head: true }).eq("event_id", id).eq("status", "waitlist"),
      ev.host_id ? (async () => {
        const [{ data: hp }, { data: pf }] = await Promise.all([
          supabase.from("host_profiles").select("org_name,verified").eq("id", ev.host_id!).maybeSingle(),
          supabase.from("profiles").select("display_name,avatar_url").eq("id", ev.host_id!).maybeSingle(),
        ]);
        return { name: (hp as any)?.org_name ?? (pf as any)?.display_name, verified: !!(hp as any)?.verified, avatar: (pf as any)?.avatar_url ?? null };
      })() : Promise.resolve(undefined),
    ]);
    setEvent(enrich(ev, going ?? 0, waitlist ?? 0, hostInfo?.name, hostInfo?.verified, hostInfo?.avatar));
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [id]);

  return { event, loading, error, setEvent, refresh };
};

export interface UserRsvp {
  id: string;
  event_id: string;
  status: "going" | "waitlist" | "cancelled";
  qr_code: string;
  created_at: string;
}

export const useMyRsvp = (eventId?: string) => {
  const { user } = useAuth();
  const [rsvp, setRsvp] = useState<UserRsvp | null>(null);
  const [position, setPosition] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user || !eventId) { setRsvp(null); setPosition(0); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("rsvps").select("*").eq("event_id", eventId).eq("user_id", user.id).maybeSingle();
    const r = (data as UserRsvp) ?? null;
    setRsvp(r);
    if (r && r.status === "waitlist") {
      const { data: pos } = await supabase.rpc("waitlist_position", { _event_id: eventId, _user_id: user.id });
      setPosition((pos as number) ?? 0);
    } else {
      setPosition(0);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id, eventId]);

  return { rsvp, position, loading, refresh, setRsvp };
};

export const useMyRsvps = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<(UserRsvp & { event: DbEvent })[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("rsvps")
      .select("*, event:events(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  return { rows, loading, refresh };
};
