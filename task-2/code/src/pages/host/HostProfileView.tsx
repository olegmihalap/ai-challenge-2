import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pencil, Globe, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/common/LoadingState";

interface Data {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  org_name: string | null;
  description: string | null;
  website: string | null;
}

const HostProfileView = () => {
  const { user, loading } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: host }] = await Promise.all([
        supabase.from("profiles").select("display_name,bio,avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("host_profiles").select("org_name,description,website").eq("id", user.id).maybeSingle(),
      ]);
      setData({
        display_name: prof?.display_name ?? null,
        avatar_url: prof?.avatar_url ?? null,
        bio: prof?.bio ?? null,
        org_name: host?.org_name ?? null,
        description: host?.description ?? null,
        website: host?.website ?? null,
      });
      setHydrated(true);
    })();
  }, [user?.id]);

  if (loading || !hydrated) return <LoadingState />;
  if (!user) return <Navigate to="/sign-in?redirect=/host/profile" replace />;

  const initials = (data?.display_name || data?.org_name || "G").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Host Profile</h1>
          <p className="text-sm text-muted-foreground">Your public host details.</p>
        </div>
        <Button asChild className="bg-gradient-hero text-primary-foreground shadow-glow hover:opacity-95">
          <Link to="/host/profile/edit"><Pencil className="mr-2 h-4 w-4" /> Edit</Link>
        </Button>
      </div>

      <Card className="p-6 shadow-soft space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={data?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-display text-xl font-semibold truncate">{data?.display_name || "—"}</div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              {data?.org_name || "No organization set"}
            </div>
          </div>
        </div>

        {data?.website && (
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <a href={data.website} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
              {data.website}
            </a>
          </div>
        )}

        <Section label="Personal bio" value={data?.bio} />
        <Section label="About the organization" value={data?.description} />
      </Card>
    </div>
  );
};

const Section = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="space-y-1">
    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    <p className="whitespace-pre-wrap text-sm">{value || <span className="text-muted-foreground">—</span>}</p>
  </div>
);

export default HostProfileView;
