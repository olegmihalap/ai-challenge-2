import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/event/StatusBadge";
import { StarRating } from "./StarRating";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";
import { ReportDialog } from "@/components/moderation/ReportDialog";
import { Link } from "react-router-dom";

interface FeedbackRow {
  id: string;
  rating: number;
  comment: string | null;
  status: "pending" | "visible" | "hidden";
  created_at: string;
  user_id: string;
  author?: string | null;
}

interface Props {
  eventId: string;
  ended: boolean;
  isAttendee: boolean;
  isHost: boolean;
}

const COMMENT_MAX = 600;

export const EventFeedback = ({ eventId, ended, isAttendee, isHost }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [mine, setMine] = useState<FeedbackRow | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("feedback")
      .select("id,rating,comment,status,created_at,user_id")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as FeedbackRow[];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id,display_name").in("id", userIds)
      : { data: [] as any };
    const names: Record<string, string> = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.display_name]));
    const enriched = rows.map((r) => ({ ...r, author: names[r.user_id] ?? "Attendee" }));
    setItems(enriched);
    setMine(user ? enriched.find((r) => r.user_id === user.id) ?? null : null);
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [eventId, user?.id]);

  const submit = async () => {
    if (!user || rating < 1) { toast.error("Pick a rating first"); return; }
    if (comment.length > COMMENT_MAX) { toast.error("Comment too long"); return; }
    setBusy(true);
    const { error } = await supabase.from("feedback").insert({
      event_id: eventId,
      user_id: user.id,
      rating,
      comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Thanks for your feedback!");
    setRating(0); setComment("");
    refresh();
  };

  const moderate = async (id: string, status: "visible" | "hidden") => {
    const prev = items;
    setItems((it) => it.map((x) => (x.id === id ? { ...x, status } : x)));
    const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
    if (error) { setItems(prev); toast.error(error.message); }
    else toast.success(status === "hidden" ? "Hidden from public" : "Restored");
  };

  const visibleItems = isHost ? items : items.filter((i) => i.status === "visible" || i.user_id === user?.id);
  const ratedAvg = items.filter((i) => i.status !== "hidden");
  const avg = ratedAvg.length ? ratedAvg.reduce((a, b) => a + b.rating, 0) / ratedAvg.length : 0;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Reviews</h2>
        {ratedAvg.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <StarRating value={avg} readOnly size="sm" />
            <span className="font-semibold">{avg.toFixed(1)}</span>
            <span className="text-muted-foreground">· {ratedAvg.length} review{ratedAvg.length === 1 ? "" : "s"}</span>
          </div>
        )}
      </div>

      {ended && isAttendee && !mine && (
        <Card className="space-y-3 bg-gradient-card p-5 shadow-soft">
          <div>
            <div className="font-display text-base font-semibold">How was the event?</div>
            <div className="text-xs text-muted-foreground">Your review will appear publicly.</div>
          </div>
          <StarRating value={rating} onChange={setRating} size="lg" />
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share what you loved (optional)"
            rows={3}
            maxLength={COMMENT_MAX}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{comment.length}/{COMMENT_MAX}</span>
            <Button onClick={submit} disabled={busy || rating < 1}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit review
            </Button>
          </div>
        </Card>
      )}

      {ended && !isAttendee && !user && (
        <Card className="p-4 text-sm text-muted-foreground shadow-soft">
          <Link to="/sign-in" className="font-medium text-primary hover:underline">Sign in</Link> to leave feedback if you attended.
        </Card>
      )}
      {!ended && (
        <Card className="p-4 text-sm text-muted-foreground shadow-soft">
          Reviews open after the event ends.
        </Card>
      )}

      {loading ? null : visibleItems.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-6 text-center shadow-soft">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((r) => (
            <Card key={r.id} className="p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-primary">{(r.author ?? "A").slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.author}</span>
                    <StarRating value={r.rating} readOnly size="sm" />
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                    {r.status === "hidden" && <StatusBadge variant="muted">Hidden</StatusBadge>}
                  </div>
                  {r.comment && <p className="mt-1.5 whitespace-pre-line text-sm text-foreground/90">{r.comment}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {isHost && r.status === "visible" && (
                      <Button size="sm" variant="outline" onClick={() => moderate(r.id, "hidden")}>Hide</Button>
                    )}
                    {isHost && r.status === "hidden" && (
                      <Button size="sm" variant="outline" onClick={() => moderate(r.id, "visible")}>Restore</Button>
                    )}
                    {user && user.id !== r.user_id && (
                      <ReportDialog target={{ kind: "feedback", id: r.id }} />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};
