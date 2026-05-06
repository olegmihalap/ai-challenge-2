import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface HostEventRow {
  id: string;
  title: string;
  status: "draft" | "published" | "cancelled" | "completed";
  starts_at: string;
  ends_at: string | null;
  capacity: number;
  cover_image_url: string | null;
  location: string | null;
  attending: number;
  waitlist: number;
}

export interface HostStats {
  totalEvents: number;
  publishedEvents: number;
  draftEvents: number;
  upcomingEvents: number;
  totalRsvps: number;
  totalWaitlist: number;
  pendingGallery: number;
  openReports: number;
}

export const useHostData = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<HostEventRow[]>([]);
  const [stats, setStats] = useState<HostStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data: evs } = await supabase
      .from("events")
      .select("*")
      .eq("host_id", user.id)
      .order("starts_at", { ascending: true });

    const ids = (evs ?? []).map((e: any) => e.id);
    const going: Record<string, number> = {};
    const wait: Record<string, number> = {};
    if (ids.length) {
      const { data: rsvps } = await supabase
        .from("rsvps")
        .select("event_id,status")
        .in("event_id", ids)
        .in("status", ["going", "waitlist"]);
      rsvps?.forEach((r: any) => {
        const b = r.status === "going" ? going : wait;
        b[r.event_id] = (b[r.event_id] ?? 0) + 1;
      });
    }

    const rows: HostEventRow[] = (evs ?? []).map((e: any) => ({
      ...e,
      attending: going[e.id] ?? 0,
      waitlist: wait[e.id] ?? 0,
    }));
    setEvents(rows);

    const now = Date.now();
    const upcoming = rows.filter((r) => r.status === "published" && new Date(r.ends_at ?? r.starts_at).getTime() >= now);
    const totalRsvps = rows.reduce((acc, r) => acc + r.attending, 0);
    const totalWaitlist = rows.reduce((acc, r) => acc + r.waitlist, 0);

    const [{ count: pendingGallery }, { count: openReports }] = await Promise.all([
      ids.length
        ? supabase.from("gallery_items").select("*", { count: "exact", head: true }).in("event_id", ids).eq("status", "pending")
        : Promise.resolve({ count: 0 } as any),
      ids.length
        ? supabase.from("reports").select("*", { count: "exact", head: true }).in("event_id", ids).eq("status", "open")
        : Promise.resolve({ count: 0 } as any),
    ]);

    setStats({
      totalEvents: rows.length,
      publishedEvents: rows.filter((r) => r.status === "published").length,
      draftEvents: rows.filter((r) => r.status === "draft").length,
      upcomingEvents: upcoming.length,
      totalRsvps,
      totalWaitlist,
      pendingGallery: pendingGallery ?? 0,
      openReports: openReports ?? 0,
    });
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  return { events, stats, loading, refresh };
};
