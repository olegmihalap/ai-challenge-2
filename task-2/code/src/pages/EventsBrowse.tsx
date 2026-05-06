import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { EventCard } from "@/components/event/EventCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, AlertCircle, CalendarIcon, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/EmptyState";
import { EventGridSkeleton } from "@/components/common/Skeletons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useEvents } from "@/hooks/useEvents";
import { isPastEvent } from "@/lib/event-helpers";
import { usePageView } from "@/hooks/useAnalytics";
import type { DateRange } from "react-day-picker";

const PAGE_SIZE = 12;

const CATEGORIES = ["All", "Music", "Networking", "Wellness", "Workshop", "Community", "Tech"];

type Sort = "upcoming" | "newest" | "popular";

const EventsBrowse = () => {
  const { events, loading, error } = useEvents();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [includePast, setIncludePast] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("upcoming");
  const [range, setRange] = useState<DateRange | undefined>();
  const [loc, setLoc] = useState<string>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  usePageView("events_browse");

  useEffect(() => { setVisible(PAGE_SIZE); }, [q, cat, includePast, freeOnly, sort, range, loc]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => { if (e.location) set.add(e.location); });
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    let list = events.slice();
    if (cat !== "All") list = list.filter((e) => e.category === cat);
    if (freeOnly) list = list.filter((e) => e.is_free);
    if (!includePast) list = list.filter((e) => !isPastEvent(e));
    if (loc !== "all") list = list.filter((e) => e.location === loc);
    if (range?.from) {
      const from = new Date(range.from); from.setHours(0, 0, 0, 0);
      list = list.filter((e) => new Date(e.starts_at) >= from);
    }
    if (range?.to) {
      const to = new Date(range.to); to.setHours(23, 59, 59, 999);
      list = list.filter((e) => new Date(e.starts_at) <= to);
    }
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((e) => e.title.toLowerCase().includes(s) || (e.location ?? "").toLowerCase().includes(s) || e.host_name.toLowerCase().includes(s));
    if (sort === "upcoming") list.sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
    if (sort === "newest") list.sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
    if (sort === "popular") list.sort((a, b) => b.attending - a.attending);
    return list;
  }, [events, q, cat, includePast, freeOnly, sort, range, loc]);

  const rangeLabel = range?.from
    ? range.to
      ? `${format(range.from, "MMM d")} – ${format(range.to, "MMM d, yyyy")}`
      : format(range.from, "MMM d, yyyy")
    : "Any date";

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Explore Events</h1>
        <p className="mt-1 text-muted-foreground">Discover what's happening in your community.</p>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events, locations, or hosts..." className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming soon</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="popular">Most popular</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-8 flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start gap-2 font-normal", !range?.from && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4" />
                {rangeLabel}
                {range?.from && (
                  <X className="ml-1 h-3.5 w-3.5 hover:text-destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRange(undefined); }} />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={range}
                onSelect={setRange}
                numberOfMonths={2}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Select value={loc} onValueChange={setLoc}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Any location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any location</SelectItem>
                {locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="includePast" checked={includePast} onCheckedChange={setIncludePast} />
              <Label htmlFor="includePast" className="cursor-pointer text-sm">Include past</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="free" checked={freeOnly} onCheckedChange={setFreeOnly} />
              <Label htmlFor="free" className="cursor-pointer text-sm">Free only</Label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors", cat === c ? "bg-primary text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>{c}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <EventGridSkeleton />
      ) : error ? (
        <EmptyState icon={AlertCircle} title="Couldn't load events" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No events found" description="Try a different search, date range, or location." />
      ) : (
        <>
          <div className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            Showing <span className="font-medium text-foreground">{Math.min(visible, filtered.length)}</span> of {filtered.length} {filtered.length === 1 ? "event" : "events"}
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.slice(0, visible).map((e) => <EventCard key={e.id} event={e} />)}
          </div>
          {visible < filtered.length && (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>Load more</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EventsBrowse;
