import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Image as ImageIcon, Eye, Loader2, Check, Lock, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/common/LoadingState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import ReactMarkdown from "react-markdown";
import { isPastEvent } from "@/lib/event-helpers";
import { CATEGORIES as ALL_CATEGORIES } from "@/lib/mock-events";
const CATEGORIES = ALL_CATEGORIES.filter((c) => c !== "All");

type Status = "draft" | "published" | "cancelled" | "completed";
type Visibility = "public" | "unlisted";

interface FormState {
  title: string;
  description: string;
  cover_image_url: string;
  category: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location: string;
  capacity: number;
  visibility: Visibility;
  organizer_contact: string;
  is_free: boolean;
  status: Status;
}

const empty: FormState = {
  title: "",
  description: "",
  cover_image_url: "",
  category: CATEGORIES[0] ?? "Music",
  starts_at: "",
  ends_at: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  location: "",
  capacity: 50,
  visibility: "public",
  organizer_contact: "",
  is_free: true,
  status: "draft",
};

const toInput = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

const baseSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  description: z.string().max(5000).optional(),
  category: z.string().min(1, "Category is required"),
  location: z.string().min(1, "Location is required").max(200),
  starts_at: z.string().min(1, "Start time is required"),
  ends_at: z.string().optional(),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(100000),
  cover_image_url: z.string().url("Banner must be a valid URL").or(z.literal("")),
  organizer_contact: z.string().max(200).optional(),
});

const TZ_OPTIONS = ["UTC", "America/Los_Angeles", "America/New_York", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"];

const EventEditor = () => {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [eventId, setEventId] = useState<string | null>(id ?? null);
  const [isEnded, setIsEnded] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load existing
  useEffect(() => {
    if (!editing) return;
    (async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).maybeSingle();
      if (error || !data) { toast.error("Event not found"); nav("/host/events"); return; }
      setForm({
        title: data.title ?? "",
        description: data.description ?? "",
        cover_image_url: data.cover_image_url ?? "",
        category: data.category ?? CATEGORIES[0] ?? "Music",
        starts_at: toInput(data.starts_at),
        ends_at: toInput(data.ends_at),
        timezone: (data as any).timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: data.location ?? "",
        capacity: data.capacity ?? 50,
        visibility: ((data as any).visibility as Visibility) ?? "public",
        organizer_contact: (data as any).organizer_contact ?? "",
        is_free: (data as any).is_free ?? true,
        status: data.status as Status,
      });
      setIsEnded(isPastEvent(data as any));
      setLoading(false);
    })();
  }, [id]);

  const buildPayload = (overrides: Partial<FormState> = {}) => {
    const f = { ...form, ...overrides };
    return {
      host_id: user!.id,
      title: f.title,
      description: f.description || null,
      cover_image_url: f.cover_image_url || null,
      category: f.category || null,
      location: f.location || null,
      starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
      ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
      capacity: Number(f.capacity) || 1,
      visibility: f.visibility,
      timezone: f.timezone,
      organizer_contact: f.organizer_contact || null,
      is_free: f.is_free,
      status: f.status,
    };
  };

  const validate = (status: Status): boolean => {
    const result = baseSchema.safeParse(form);
    const errs: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) errs[issue.path[0] as string] = issue.message;
    }
    if (status === "published" && form.starts_at) {
      const start = new Date(form.starts_at).getTime();
      if (start < Date.now()) errs.starts_at = "Published events must start in the future";
      if (form.ends_at && new Date(form.ends_at).getTime() < start) errs.ends_at = "End must be after start";
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Please fix the highlighted fields");
      return false;
    }
    return true;
  };

  // Autosave drafts (debounced) — only after first explicit save creates the row
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!eventId || isEnded) return;
    if (form.status === "published") return; // don't autosave-overwrite published
    if (!form.title.trim()) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setAutoSaving(true);
      const { error } = await supabase.from("events").update(buildPayload({ status: "draft" })).eq("id", eventId);
      setAutoSaving(false);
      if (!error) setLastSavedAt(new Date());
    }, 1500);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
    // eslint-disable-next-line
  }, [form, eventId, isEnded]);

  const save = async (status: Status) => {
    if (!user) return;
    if (isEnded && status !== "draft") {
      toast.error("Ended events cannot be edited");
      return;
    }
    if (status === "published" && !validate("published")) return;
    if (status === "draft" && !form.title.trim()) {
      toast.error("Add a title to save a draft");
      return;
    }
    setSaving(true);
    const payload = buildPayload({ status });
    let error;
    if (eventId) {
      ({ error } = await supabase.from("events").update(payload).eq("id", eventId));
    } else {
      const ins = await supabase.from("events").insert(payload).select("id").single();
      error = ins.error;
      if (ins.data) setEventId(ins.data.id);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    setForm((f) => ({ ...f, status }));
    setLastSavedAt(new Date());
    toast.success(
      status === "published" ? "Event published" : status === "draft" ? "Saved as draft" : "Saved",
    );
    if (status === "published") nav("/host/events");
  };

  const onUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Banner must be an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("event-banners").upload(path, file, { upsert: false, contentType: file.type });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data } = supabase.storage.from("event-banners").getPublicUrl(path);
    setForm((f) => ({ ...f, cover_image_url: data.publicUrl }));
    setUploading(false);
    toast.success("Banner uploaded");
  };

  const previewDate = useMemo(() => (form.starts_at ? new Date(form.starts_at) : null), [form.starts_at]);

  if (loading) return <LoadingState />;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/host/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to events
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {autoSaving ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Autosaving…</>
            ) : lastSavedAt ? (
              <><Check className="h-3 w-3 text-success" /> Saved {lastSavedAt.toLocaleTimeString()}</>
            ) : null}
          </div>
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">{editing ? "Edit event" : "Create event"}</h1>
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium text-foreground capitalize">{form.status}</span>
            {isEnded && <span className="ml-2 text-warning">· Ended (read-only)</span>}
          </p>
        </div>

        <Tabs defaultValue="edit">
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="mr-1.5 h-3.5 w-3.5" />Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-6">
            <fieldset disabled={isEnded} className="space-y-6">
              <Card className="space-y-5 p-6 shadow-soft">
                <Field label="Title *" error={errors.title}>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="A great event name" maxLength={120} />
                </Field>

                <Field label="Banner image" hint="JPG/PNG up to 5 MB. Recommended 1600×900.">
                  <div className="space-y-3">
                    {form.cover_image_url && (
                      <img src={form.cover_image_url} alt="Banner preview" className="aspect-[16/9] w-full rounded-lg object-cover" />
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex">
                        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                        <Button type="button" variant="outline" disabled={uploading} asChild>
                          <span>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{uploading ? "Uploading…" : "Upload image"}</span>
                        </Button>
                      </label>
                      <Input
                        className="flex-1 min-w-[200px]"
                        placeholder="…or paste an image URL"
                        value={form.cover_image_url}
                        onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
                      />
                    </div>
                    {errors.cover_image_url && <p className="text-xs text-destructive">{errors.cover_image_url}</p>}
                  </div>
                </Field>

                <Field label="Description" hint="Markdown supported (headings, lists, links).">
                  <Textarea rows={8} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="## What to expect&#10;- Networking&#10;- Talks" />
                </Field>
              </Card>

              <Card className="space-y-5 p-6 shadow-soft">
                <h3 className="font-display text-base font-semibold">Logistics</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Category">
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Location *" error={errors.location}>
                    <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Venue, City" />
                  </Field>
                  <Field label="Starts at *" error={errors.starts_at}>
                    <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                  </Field>
                  <Field label="Ends at" error={errors.ends_at}>
                    <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                  </Field>
                  <Field label="Timezone">
                    <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[...new Set([form.timezone, ...TZ_OPTIONS])].map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Capacity *" error={errors.capacity}>
                    <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
                  </Field>
                </div>
                <Field label="Organizer contact" hint="Email or phone displayed to attendees.">
                  <Input value={form.organizer_contact} onChange={(e) => setForm({ ...form, organizer_contact: e.target.value })} placeholder="hello@yourorg.com" />
                </Field>
              </Card>

              <Card className="space-y-5 p-6 shadow-soft">
                <h3 className="font-display text-base font-semibold">Visibility</h3>
                <RadioGroup value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v as Visibility })} className="grid gap-3 sm:grid-cols-2">
                  <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${form.visibility === "public" ? "border-primary bg-primary/5" : "border-border"}`}>
                    <RadioGroupItem value="public" />
                    <div>
                      <div className="font-medium">Public</div>
                      <div className="text-xs text-muted-foreground">Discoverable in browse and search.</div>
                    </div>
                  </label>
                  <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${form.visibility === "unlisted" ? "border-primary bg-primary/5" : "border-border"}`}>
                    <RadioGroupItem value="unlisted" />
                    <div>
                      <div className="font-medium">Unlisted</div>
                      <div className="text-xs text-muted-foreground">Only people with the link can view.</div>
                    </div>
                  </label>
                </RadioGroup>
              </Card>

              <Card className="space-y-4 p-6 shadow-soft">
                <h3 className="font-display text-base font-semibold">Pricing</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_free: true })}
                    className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${form.is_free ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                  >
                    <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${form.is_free ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                      {form.is_free && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                    </div>
                    <div>
                      <div className="font-medium">Free</div>
                      <div className="text-xs text-muted-foreground">No charge to attendees.</div>
                    </div>
                  </button>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        aria-disabled
                        className="flex cursor-not-allowed items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 opacity-70"
                      >
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 font-medium">
                            Paid
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              <Lock className="h-2.5 w-2.5" /> Soon
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">Sell tickets with checkout.</div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Coming soon</TooltipContent>
                  </Tooltip>
                </div>
              </Card>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => save("draft")} disabled={saving}>Save draft</Button>
                {form.status === "published" && (
                  <Button type="button" variant="outline" onClick={() => save("draft")} disabled={saving}>Unpublish</Button>
                )}
                <Button type="button" onClick={() => save("published")} disabled={saving} className="bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95">
                  {saving ? "Saving…" : form.status === "published" ? "Update" : "Publish event"}
                </Button>
              </div>
            </fieldset>
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <Card className="overflow-hidden shadow-soft">
              {form.cover_image_url ? (
                <img src={form.cover_image_url} alt="Banner" className="aspect-[16/9] w-full object-cover" />
              ) : (
                <div className="flex aspect-[16/9] w-full items-center justify-center bg-muted text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
              <div className="space-y-4 p-6">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-accent-foreground">{form.category}</span>
                  <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-success">Free</span>
                  {form.visibility === "unlisted" && (
                    <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-warning">Unlisted</span>
                  )}
                </div>
                <h2 className="font-display text-2xl font-bold">{form.title || "Untitled event"}</h2>
                <p className="text-sm text-muted-foreground">
                  {previewDate ? previewDate.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }) : "No date set"}
                  {form.location && ` · ${form.location}`}
                </p>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {form.description ? (
                    <ReactMarkdown>{form.description}</ReactMarkdown>
                  ) : (
                    <p className="italic text-muted-foreground">No description yet.</p>
                  )}
                </div>
                {form.organizer_contact && (
                  <p className="text-sm text-muted-foreground">Contact: <span className="text-foreground">{form.organizer_contact}</span></p>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};

const Field = ({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-sm">{label}</Label>
    {children}
    {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

export default EventEditor;
