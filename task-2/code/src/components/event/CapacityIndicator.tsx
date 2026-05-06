import { cn } from "@/lib/utils";

export const CapacityIndicator = ({
  current,
  capacity,
  showLabel = false,
  className,
}: {
  current: number;
  capacity: number;
  showLabel?: boolean;
  className?: string;
}) => {
  const pct = Math.min(100, Math.round((current / capacity) * 100));
  const remaining = Math.max(0, capacity - current);
  const full = current >= capacity;
  const almost = !full && pct >= 80;
  const tone = full ? "bg-destructive" : almost ? "bg-warning" : "bg-success";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{current} of {capacity} attending</span>
          <span className={cn("font-medium", full ? "text-destructive" : almost ? "text-warning" : "text-success")}>
            {full ? "Full · waitlist open" : `${remaining} ${remaining === 1 ? "seat" : "seats"} left`}
          </span>
        </div>
      )}
    </div>
  );
};
