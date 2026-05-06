import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface Props {
  eventId: string;
  canUpload: boolean;
  reason?: "auth" | "rsvp" | null;
  onUploaded?: () => void;
}

export const GalleryUploader = ({ eventId, canUpload, reason, onUploaded }: Props) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList) => {
    if (!user) return;
    const list = Array.from(files);
    const valid = list.filter((f) => {
      if (!ACCEPTED.includes(f.type)) {
        toast.error(`${f.name}: unsupported file type`);
        return false;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: exceeds 8MB limit`);
        return false;
      }
      return true;
    });
    if (!valid.length) return;

    setBusy(true);
    setProgress({ done: 0, total: valid.length });
    let success = 0;
    for (const file of valid) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${eventId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("event-gallery").upload(path, file, { contentType: file.type });
      if (upErr) {
        toast.error(`${file.name}: ${upErr.message}`);
      } else {
        const { data: pub } = supabase.storage.from("event-gallery").getPublicUrl(path);
        const { error: insErr } = await supabase.from("gallery_items").insert({
          event_id: eventId,
          user_id: user.id,
          image_url: pub.publicUrl,
          status: "pending",
        });
        if (insErr) toast.error(insErr.message);
        else success++;
      }
      setProgress((p) => p && { ...p, done: p.done + 1 });
    }
    setBusy(false);
    setProgress(null);
    if (success > 0) {
      toast.success(`${success} photo${success === 1 ? "" : "s"} submitted for review`);
      onUploaded?.();
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  if (!canUpload) {
    return (
      <Card className="flex flex-col items-center gap-2 border-dashed bg-muted/30 p-6 text-center shadow-soft">
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
        {reason === "auth" ? (
          <p className="text-sm text-muted-foreground">
            <Link to="/sign-in" className="font-medium text-primary hover:underline">Sign in</Link> and RSVP to share photos.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">RSVP to this event to share photos.</p>
        )}
      </Card>
    );
  }

  return (
    <Card className="border-dashed bg-muted/20 p-5 shadow-soft">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold">Share your photos</p>
          <p className="text-xs text-muted-foreground">JPG, PNG, WEBP or GIF · up to 8MB · reviewed before going live</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={busy} size="sm">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {busy && progress ? `Uploading ${progress.done}/${progress.total}` : "Upload photos"}
        </Button>
      </div>
    </Card>
  );
};
