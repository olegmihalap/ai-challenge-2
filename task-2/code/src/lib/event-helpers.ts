export const isPastEvent = (e: { ends_at?: string | null; starts_at: string }) =>
  new Date(e.ends_at ?? e.starts_at).getTime() < Date.now();

export type CapacityStatus = "available" | "almost_full" | "full" | "waitlist" | "ended";

export const getCapacityStatus = (e: {
  starts_at: string;
  ends_at?: string | null;
  capacity: number;
  attending: number;
  waitlist_count?: number;
}): CapacityStatus => {
  if (isPastEvent(e)) return "ended";
  if (e.attending >= e.capacity) {
    return (e.waitlist_count ?? 0) > 0 ? "waitlist" : "full";
  }
  const pct = e.attending / Math.max(1, e.capacity);
  if (pct >= 0.8) return "almost_full";
  return "available";
};

export const capacityLabel: Record<CapacityStatus, string> = {
  available: "Available",
  almost_full: "Almost full",
  full: "Full",
  waitlist: "Waitlist open",
  ended: "Ended",
};
