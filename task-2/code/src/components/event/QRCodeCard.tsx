import { Card } from "@/components/ui/card";
import { QrCode } from "lucide-react";

export const QRCodeCard = ({ code, eventTitle }: { code: string; eventTitle: string }) => {
  // Simple QR placeholder using external service for visual demo
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(code)}`;
  return (
    <Card className="bg-gradient-card flex flex-col items-center gap-4 p-6 shadow-soft">
      <div className="flex w-full items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-1.5"><QrCode className="h-3.5 w-3.5" /> Entry pass</span>
        <span className="font-mono">{code.slice(0, 8)}</span>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-soft">
        <img src={url} alt={`QR code for ${eventTitle}`} className="h-44 w-44" />
      </div>
      <p className="text-center font-display text-sm font-semibold">{eventTitle}</p>
      <p className="text-center text-xs text-muted-foreground">Show this at the door for check-in</p>
    </Card>
  );
};
