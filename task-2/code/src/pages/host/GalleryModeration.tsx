import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, X, EyeOff, Eye, Image as ImageIcon } from "lucide-react";
import { StatusBadge } from "@/components/event/StatusBadge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { Lightbox } from "@/components/gallery/Lightbox";

type GStatus = "pending" | "approved" | "rejected" | "hidden";

interface Item {
  id: string;
  image_url: string;
  caption: string | null;
  status: GStatus;
  created_at: string;
  event_id: string;
  event_title: string;
  user_id: string;
  user_name: string | null;
}

const STATUS_VARIANT: Record<GStatus, "warning" | "success" | "destructive" | "muted"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  hidden: "muted",
};

const GalleryModeration = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<GStatus>("pending");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const { data: events } = await supabase.from("events").select("id,title").eq("host_id", user.id);
    const ids = (events ?? []).map((e: any) => e.id);
    const titles: Record<string, string> = Object.fromEntries((events ?? []).map((e: any) => [e.id, e.title]));
    if (!ids.length) { setItems([]); setLoading(false); return; }
    const { data: rows } = await supabase
      .from("gallery_items")
      .select("id,image_url,caption,status,created_at,event_id,user_id")
      .in("event_id", ids)
      .order("created_at", { ascending: false });
    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id,display_name").in("id", userIds)
      : { data: [] as any };
    const names: Record<string, string> = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.display_name]));
    setItems(
      (rows ?? []).map((r: any) => ({
        ...r,
        event_title: titles[r.event_id] ?? "Event",
        user_name: names[r.user_id] ?? null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  const updateStatus = async (id: string, status: GStatus) => {
    const prev = items;
    setItems((it) => it.map((x) => (x.id === id ? { ...x, status } : x)));
    const { error } = await supabase.from("gallery_items").update({ status }).eq("id", id);
    if (error) {
      setItems(prev);
      toast.error(error.message);
    } else {
      const labels: Record<GStatus, string> = { pending: "Set to pending", approved: "Approved", rejected: "Rejected", hidden: "Hidden from public" };
      toast.success(labels[status]);
    }
  };

  const grouped = useMemo(() => {
    const g: Record<GStatus, Item[]> = { pending: [], approved: [], rejected: [], hidden: [] };
    items.forEach((it) => g[it.status].push(it));
    return g;
  }, [items]);

  const visible = grouped[tab];
  const lightboxImages = visible.map((v) => ({ id: v.id, url: v.image_url, caption: v.caption }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Gallery Moderation</h1>
        <p className="text-sm text-muted-foreground">Review attendee photos before they go live.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as GStatus)}>
        <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-flex">
          <TabsTrigger value="pending">Pending {grouped.pending.length > 0 && <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 text-xs">{grouped.pending.length}</span>}</TabsTrigger>
          <TabsTrigger value="approved">Approved <span className="ml-1.5 text-xs text-muted-foreground">{grouped.approved.length}</span></TabsTrigger>
          <TabsTrigger value="hidden">Hidden <span className="ml-1.5 text-xs text-muted-foreground">{grouped.hidden.length}</span></TabsTrigger>
          <TabsTrigger value="rejected">Rejected <span className="ml-1.5 text-xs text-muted-foreground">{grouped.rejected.length}</span></TabsTrigger>
        </TabsList>

        {(["pending", "approved", "hidden", "rejected"] as GStatus[]).map((s) => (
          <TabsContent key={s} value={s} className="mt-5">
            {loading ? (
              <LoadingState />
            ) : grouped[s].length === 0 ? (
              <EmptyState icon={ImageIcon} title={`No ${s} photos`} description={s === "pending" ? "You're all caught up." : `No photos in this state.`} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[s].map((it, i) => (
                  <Card key={it.id} className="overflow-hidden shadow-soft">
                    <button onClick={() => setLightbox(i)} className="block w-full">
                      <img src={it.image_url} alt="" className="aspect-square w-full object-cover" />
                    </button>
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{it.event_title}</div>
                          <div className="text-xs text-muted-foreground">by {it.user_name ?? "Attendee"} · {new Date(it.created_at).toLocaleDateString()}</div>
                        </div>
                        <StatusBadge variant={STATUS_VARIANT[it.status]}>{it.status}</StatusBadge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {it.status !== "approved" && (
                          <Button size="sm" className="flex-1 bg-success text-success-foreground hover:bg-success/90" onClick={() => updateStatus(it.id, "approved")}>
                            <Check className="mr-1 h-3.5 w-3.5" /> Approve
                          </Button>
                        )}
                        {it.status === "approved" && (
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => updateStatus(it.id, "hidden")}>
                            <EyeOff className="mr-1 h-3.5 w-3.5" /> Hide
                          </Button>
                        )}
                        {it.status === "hidden" && (
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => updateStatus(it.id, "approved")}>
                            <Eye className="mr-1 h-3.5 w-3.5" /> Unhide
                          </Button>
                        )}
                        {it.status !== "rejected" && (
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => updateStatus(it.id, "rejected")}>
                            <X className="mr-1 h-3.5 w-3.5" /> Reject
                          </Button>
                        )}
                        {it.status === "rejected" && (
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => updateStatus(it.id, "pending")}>
                            Restore
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Lightbox images={lightboxImages} startIndex={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
};

export default GalleryModeration;
