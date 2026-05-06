import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface LightboxImage {
  id: string;
  url: string;
  caption?: string | null;
}

interface Props {
  images: LightboxImage[];
  startIndex: number | null;
  onClose: () => void;
}

export const Lightbox = ({ images, startIndex, onClose }: Props) => {
  const [idx, setIdx] = useState(startIndex ?? 0);

  useEffect(() => { if (startIndex !== null) setIdx(startIndex); }, [startIndex]);

  useEffect(() => {
    if (startIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + images.length) % images.length);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startIndex, images.length, onClose]);

  if (startIndex === null || !images.length) return null;
  const img = images[idx];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl border-0 bg-transparent p-0 shadow-none">
        <div className="relative">
          <img src={img.url} alt={img.caption ?? ""} className="max-h-[85vh] w-full rounded-xl object-contain" />
          {images.length > 1 && (
            <>
              <Button size="icon" variant="secondary" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full" onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full" onClick={() => setIdx((i) => (i + 1) % images.length)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs text-foreground backdrop-blur">
                {idx + 1} / {images.length}
              </div>
            </>
          )}
          {img.caption && (
            <div className="absolute bottom-3 left-3 max-w-[60%] rounded-lg bg-background/80 px-3 py-2 text-sm text-foreground backdrop-blur">
              {img.caption}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
