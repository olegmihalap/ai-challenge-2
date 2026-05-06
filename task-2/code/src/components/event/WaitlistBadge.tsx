import { StatusBadge } from "./StatusBadge";
import { Clock } from "lucide-react";

export const WaitlistBadge = ({ position }: { position?: number }) => (
  <StatusBadge variant="warning" className="gap-1">
    <Clock className="h-3 w-3" />
    {position ? `Waitlist #${position}` : "Waitlist"}
  </StatusBadge>
);
