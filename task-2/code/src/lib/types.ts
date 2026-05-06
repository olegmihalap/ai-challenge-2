export type Role = "visitor" | "user" | "host" | "checker" | "admin";

export type EventStatus = "draft" | "published" | "cancelled" | "completed";
export type RsvpStatus = "going" | "waitlist" | "cancelled";
export type GalleryStatus = "pending" | "approved" | "rejected";
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  starts_at: string;
  ends_at?: string;
  capacity: number;
  attending: number;
  cover_image_url: string;
  status: EventStatus;
  host: { name: string; avatar?: string; verified?: boolean };
}
