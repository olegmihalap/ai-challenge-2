import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/event/StatusBadge";
import { Flag, EyeOff, Eye, Check, X, Calendar, Image as ImageIcon, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { Link } from "react-router-dom";

type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
type Kind = "event" | "gallery" | "feedback";

interface Report {
  id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  reporter_id: string;
  reporter_name: string | null;
  kind: Kind;
  target_id: string;
  // hydrated target preview
  preview: {
    title: string;
    subtitle?: string | null;
    image?: string | null;
    body?: string | null;
    eventId?: string | null;
    hidden?: boolean; // current visibility (hidden/rejected)
  };
}

const KIND_META: Record<Kind, { label: string; icon: typeof Flag; tone: string }> = {
  event: { label: "Event", icon: Calendar, tone: "bg-primary/10 text-primary" },
  gallery: { label: "Photo", icon: ImageIcon, tone: "bg-accent/10 text-accent-foreground" },
  feedback: { label: "Review", icon: MessageSquare, tone: "bg-warning/10 text-warning" },
};

const STATUS_VARIANT: Record<ReportStatus, "destructive" | "warning" | "success" | "muted"> = {
  open: "destructive",
  reviewing: "warning",
  resolved: "success",
  dismissed: "muted",
};

const ReportsReview = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"open" | "hidden" | "resolved">("open");
  const [actingId, setActingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("reports")
      .select("id,reason,details,status,created_at,resolved_at,reporter_id,event_id,gallery_item_id,feedback_id")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }

    const reporterIds = Array.from(new Set((rows ?? []).map((r: any) => r.reporter_id)));
    const eventIds = Array.from(new Set((rows ?? []).map((r: any) => r.event_id).filter(Boolean)));
    const galleryIds = Array.from(new Set((rows ?? []).map((r: any) => r.gallery_item_id).filter(Boolean)));
    const feedbackIds = Array.from(new Set((rows ?? []).map((r: any) => r.feedback_id).filter(Boolean)));

    const [{ data: profiles }, { data: events }, { data: gallery }, { data: feedback }] = await Promise.all([
      reporterIds.length ? supabase.from("profiles").select("id,display_name").in("id", reporterIds) : Promise.resolve({ data: [] as any }),
      eventIds.length ? supabase.from("events").select("id,title,starts_at,cover_image_url,status").in("id", eventIds) : Promise.resolve({ data: [] as any }),
      galleryIds.length ? supabase.from("gallery_items").select("id,image_url,caption,status,event_id").in("id", galleryIds) : Promise.resolve({ data: [] as any }),
      feedbackIds.length ? supabase.from("feedback").select("id,rating,comment,status,event_id,user_id").in("id", feedbackIds) : Promise.resolve({ data: [] as any }),
    ]);

    const names: Record<string, string> = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.display_name]));
    const eMap = new Map((events ?? []).map((e: any) => [e.id, e]));
    const gMap = new Map((gallery ?? []).map((g: any) => [g.id, g]));
    const fMap = new Map((feedback ?? []).map((f: any) => [f.id, f]));

    const enriched: Report[] = (rows ?? []).map((r: any) => {
      let kind: Kind = "event";
      let target_id = "";
      let preview: Report["preview"] = { title: "Item" };
      if (r.gallery_item_id) {
        kind = "gallery"; target_id = r.gallery_item_id;
        const g: any = gMap.get(r.gallery_item_id);
        const ev: any = g ? eMap.get(g.event_id) : null;
        preview = {
          title: ev?.title ?? "Photo",
          subtitle: g?.caption ?? null,
          image: g?.image_url,
          eventId: g?.event_id,
          hidden: g ? g.status !== "approved" : false,
        };
      } else if (r.feedback_id) {
        kind = "feedback"; target_id = r.feedback_id;
        const f: any = fMap.get(r.feedback_id);
        const ev: any = f ? eMap.get(f.event_id) : null;
        preview = {
          title: ev?.title ?? "Review",
          subtitle: f ? `★ ${f.rating}` : null,
          body: f?.comment ?? null,
          eventId: f?.event_id,
          hidden: f?.status === "hidden",
        };
      } else {
        kind = "event"; target_id = r.event_id;
        const ev: any = eMap.get(r.event_id);
        preview = {
          title: ev?.title ?? "Event",
          subtitle: ev?.starts_at ? new Date(ev.starts_at).toLocaleDateString() : null,
          image: ev?.cover_image_url,
          eventId: ev?.id,
          hidden: ev?.status !== "published",
        };
      }
      return {
        id: r.id, reason: r.reason, details: r.details, status: r.status,
        created_at: r.created_at, resolved_at: r.resolved_at,
        reporter_id: r.reporter_id, reporter_name: names[r.reporter_id] ?? "User",
        kind, target_id, preview,
      };
    });

    setReports(enriched);
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  const setReportStatus = async (r: Report, status: ReportStatus) => {
    setActingId(r.id);
    const patch: any = { status };
    if (status === "resolved" || status === "dismissed") {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = user?.id ?? null;
    } else {
      patch.resolved_at = null;
      patch.resolved_by = null;
    }
    const { error } = await supabase.from("reports").update(patch).eq("id", r.id);
    setActingId(null);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const toggleHide = async (r: Report, hide: boolean) => {
    setActingId(r.id);
    let error: any = null;
    if (r.kind === "gallery") {
      const next = hide ? "hidden" : "approved";
      ({ error } = await supabase.from("gallery_items").update({ status: next }).eq("id", r.target_id));
    } else if (r.kind === "feedback") {
      const next = hide ? "hidden" : "visible";
      ({ error } = await supabase.from("feedback").update({ status: next }).eq("id", r.target_id));
    } else if (r.kind === "event") {
      const next = hide ? "draft" : "published";
      ({ error } = await supabase.from("events").update({ status: next }).eq("id", r.target_id));
    }
    setActingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(hide ? "Item hidden from public" : "Item restored");
    if (hide) await setReportStatus(r, "resolved");
    else refresh();
  };

  const filtered = useMemo(() => {
    if (tab === "open") return reports.filter((r) => r.status === "open" || r.status === "reviewing");
    if (tab === "hidden") return reports.filter((r) => r.preview.hidden);
    return reports.filter((r) => r.status === "resolved" || r.status === "dismissed");
  }, [reports, tab]);

  const counts = useMemo(() => ({
    open: reports.filter((r) => r.status === "open" || r.status === "reviewing").length,
    hidden: reports.filter((r) => r.preview.hidden).length,
    resolved: reports.filter((r) => r.status === "resolved" || r.status === "dismissed").length,
  }), [reports]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Reports Review</h1>
        <p className="text-sm text-muted-foreground">Triage user-submitted reports across events, photos, and reviews.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="open">Open <span className="ml-1.5 rounded-full bg-destructive/15 px-1.5 text-xs text-destructive">{counts.open}</span></TabsTrigger>
          <TabsTrigger value="hidden">Hidden <span className="ml-1.5 text-xs text-muted-foreground">{counts.hidden}</span></TabsTrigger>
          <TabsTrigger value="resolved">Resolved <span className="ml-1.5 text-xs text-muted-foreground">{counts.resolved}</span></TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-5">
          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Flag} title={`No ${tab} reports`} description="Nothing here right now." />
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => {
                const meta = KIND_META[r.kind];
                const Icon = meta.icon;
                const acting = actingId === r.id;
                const isClosed = r.status === "resolved" || r.status === "dismissed";
                return (
                  <Card key={r.id} className="p-5 shadow-soft">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display font-semibold">{r.reason}</span>
                            <StatusBadge variant={STATUS_VARIANT[r.status]}>{r.status}</StatusBadge>
                            <StatusBadge variant="muted">{meta.label}</StatusBadge>
                            {r.preview.hidden && <StatusBadge variant="warning">Hidden</StatusBadge>}
                          </div>
                          {r.details && <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>}
                          <div className="mt-1 text-xs text-muted-foreground">
                            Reported by {r.reporter_name} · {new Date(r.created_at).toLocaleString()}
                            {r.resolved_at && <> · Closed {new Date(r.resolved_at).toLocaleString()}</>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Target preview */}
                    <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-3">
                      <div className="flex gap-3">
                        {r.preview.image && (
                          <img src={r.preview.image} alt="" className="h-20 w-20 flex-shrink-0 rounded-md object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{r.preview.title}</span>
                            {r.preview.subtitle && <span className="text-sm text-muted-foreground">{r.preview.subtitle}</span>}
                          </div>
                          {r.preview.body && <p className="mt-1 line-clamp-3 text-sm text-foreground/85">{r.preview.body}</p>}
                          {r.preview.eventId && (
                            <Link to={`/events/${r.preview.eventId}`} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                              View event →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {!r.preview.hidden ? (
                        <Button size="sm" variant="outline" disabled={acting} onClick={() => toggleHide(r, true)}>
                          {acting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <EyeOff className="mr-1.5 h-3.5 w-3.5" />}
                          Hide item
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={acting} onClick={() => toggleHide(r, false)}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> Restore item
                        </Button>
                      )}
                      {!isClosed && (
                        <>
                          <Button size="sm" disabled={acting} onClick={() => setReportStatus(r, "resolved")}>
                            <Check className="mr-1.5 h-3.5 w-3.5" /> Resolve
                          </Button>
                          <Button size="sm" variant="ghost" disabled={acting} onClick={() => setReportStatus(r, "dismissed")}>
                            <X className="mr-1.5 h-3.5 w-3.5" /> Dismiss
                          </Button>
                        </>
                      )}
                      {isClosed && (
                        <Button size="sm" variant="ghost" disabled={acting} onClick={() => setReportStatus(r, "open")}>
                          Reopen
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsReview;
