import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

type Target =
  | { kind: "event"; id: string }
  | { kind: "gallery"; id: string }
  | { kind: "feedback"; id: string };

const REASONS = [
  "Inappropriate content",
  "Spam or scam",
  "Harassment or hate speech",
  "Misleading information",
  "Copyright violation",
  "Other",
];

interface Props {
  target: Target;
  trigger?: React.ReactNode;
  size?: "sm" | "default" | "icon";
  variant?: "ghost" | "outline";
}

export const ReportDialog = ({ target, trigger, size = "sm", variant = "ghost" }: Props) => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) { nav("/sign-in"); return; }
    if (!reason) { toast.error("Pick a reason"); return; }
    setBusy(true);
    const payload: any = { reporter_id: user.id, reason, details: details.trim() || null };
    if (target.kind === "event") payload.event_id = target.id;
    if (target.kind === "gallery") payload.gallery_item_id = target.id;
    if (target.kind === "feedback") payload.feedback_id = target.id;
    const { error } = await supabase.from("reports").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Report submitted. Thanks for letting us know.");
    setOpen(false); setReason(""); setDetails("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size={size} variant={variant}><Flag className="mr-1.5 h-3.5 w-3.5" /> Report</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this {target.kind === "gallery" ? "photo" : target.kind}</DialogTitle>
          <DialogDescription>Tell us what's wrong. A moderator will review.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue placeholder="Choose a reason" /></SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Additional details (optional)" rows={3} maxLength={500} />
          <div className="text-right text-xs text-muted-foreground">{details.length}/500</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !reason}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
