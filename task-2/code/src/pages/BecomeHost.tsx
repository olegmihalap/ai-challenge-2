import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Navigate, useNavigate } from "react-router-dom";
import { Sparkles, Upload } from "lucide-react";
import { LoadingState } from "@/components/common/LoadingState";

const BecomeHost = () => {
  const { user, roles, loading, refreshRoles } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    display_name: "",
    org_name: "",
    bio: "",
    description: "",
    website: "",
    avatar_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be smaller than 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setForm((f) => ({ ...f, avatar_url: data.publicUrl }));
    setUploading(false);
    toast.success("Avatar uploaded");
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: host }] = await Promise.all([
        supabase.from("profiles").select("display_name,bio,avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("host_profiles").select("org_name,description,website").eq("id", user.id).maybeSingle(),
      ]);
      setForm({
        display_name: prof?.display_name ?? "",
        avatar_url: prof?.avatar_url ?? "",
        bio: prof?.bio ?? "",
        org_name: host?.org_name ?? "",
        description: host?.description ?? "",
        website: host?.website ?? "",
      });
      setHydrated(true);
    })();
  }, [user?.id]);

  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/sign-in?redirect=/become-host" replace />;

  const isHost = roles.includes("host") || roles.includes("admin");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.org_name.trim()) return toast.error("Organization name is required");
    setSaving(true);
    const { error } = await (supabase as any).rpc("become_host", {
      _org_name: form.org_name,
      _description: form.description || null,
      _website: form.website || null,
      _display_name: form.display_name || null,
      _avatar_url: form.avatar_url || null,
      _bio: form.bio || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isHost ? "Host profile updated" : "Welcome aboard, host!");
    await refreshRoles();
    nav("/host");
  };

  return (
    <div className="container max-w-2xl py-10 md:py-14">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground shadow-glow">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">{isHost ? "Edit host profile" : "Become a host"}</h1>
          <p className="mt-1 text-muted-foreground">
            {isHost
              ? "Keep your organization details up to date."
              : "Tell the community about your organization. You'll unlock the Host Console to create and manage events."}
          </p>
        </div>
      </div>

      <Card className="p-6 shadow-soft">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={form.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {(form.display_name || form.org_name || "G").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1.5">
              <Label>Avatar</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="avatar-file"
                  type="file"
                  accept="image/*"
                  onChange={onAvatarFile}
                  disabled={uploading}
                  className="sr-only"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => document.getElementById("avatar-file")?.click()}
                  className="gap-2 transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary active:scale-95"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading…" : form.avatar_url ? "Change photo" : "Upload photo"}
                </Button>
                {form.avatar_url && !uploading && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm({ ...form, avatar_url: "" })}
                    className="text-muted-foreground transition-colors hover:text-destructive active:scale-95"
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">PNG or JPG, up to 5MB.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dn">Display name</Label>
              <Input id="dn" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org">Organization *</Label>
              <Input id="org" required value={form.org_name} onChange={(e) => setForm({ ...form, org_name: e.target.value })} placeholder="Acme Collective" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="web">Website</Label>
            <Input id="web" type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://yoursite.com" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Personal bio</Label>
            <Textarea id="bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="A short intro about you." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">About the organization</Label>
            <Textarea id="desc" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What kind of events do you run?" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => nav(-1)}>Cancel</Button>
            <Button type="submit" disabled={saving || !hydrated} className="bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95">
              {saving ? "Saving…" : isHost ? "Save changes" : "Become a host"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default BecomeHost;
