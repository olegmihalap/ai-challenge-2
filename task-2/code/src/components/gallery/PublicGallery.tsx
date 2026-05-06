import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/common/EmptyState";
import { Image as ImageIcon } from "lucide-react";
import { Lightbox, LightboxImage } from "./Lightbox";
import { ReportDialog } from "@/components/moderation/ReportDialog";

export const PublicGallery = ({ eventId }: { eventId: string }) => {
  const [items, setItems] = useState<LightboxImage[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("gallery_items")
        .select("id,image_url,caption,created_at")
        .eq("event_id", eventId)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (!active) return;
      setItems((data ?? []).map((d: any) => ({ id: d.id, url: d.image_url, caption: d.caption })));
    })();
    return () => { active = false; };
  }, [eventId]);

  if (!items.length) {
    return <EmptyState icon={ImageIcon} title="No photos yet" description="Approved photos from attendees will appear here." />;
  }

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3 [&>*]:mb-3">
        {items.map((it, i) => (
          <div key={it.id} className="group relative break-inside-avoid">
            <button
              onClick={() => setOpen(i)}
              className="block w-full overflow-hidden rounded-xl shadow-soft transition hover:shadow-elevated"
            >
              <img src={it.url} alt={it.caption ?? ""} loading="lazy" className="w-full transition-transform duration-300 group-hover:scale-[1.02]" />
            </button>
            <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
              <ReportDialog target={{ kind: "gallery", id: it.id }} variant="outline" />
            </div>
          </div>
        ))}
      </div>
      <Lightbox images={items} startIndex={open} onClose={() => setOpen(null)} />
    </>
  );
};
