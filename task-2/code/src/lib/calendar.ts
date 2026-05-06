// Build a downloadable .ics file and a Google Calendar URL for an event.

export interface CalendarEventInput {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  starts_at: string;
  ends_at?: string | null;
}

const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export const googleCalendarUrl = (e: CalendarEventInput) => {
  const start = fmt(e.starts_at);
  const end = fmt(e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 2 * 3600_000).toISOString());
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${start}/${end}`,
    details: e.description ?? "",
    location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const downloadIcs = (e: CalendarEventInput) => {
  const start = fmt(e.starts_at);
  const end = fmt(e.ends_at ?? new Date(new Date(e.starts_at).getTime() + 2 * 3600_000).toISOString());
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gather//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}@gather.app`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${e.title}`,
    `DESCRIPTION:${(e.description ?? "").replace(/\n/g, "\\n")}`,
    `LOCATION:${e.location ?? ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
