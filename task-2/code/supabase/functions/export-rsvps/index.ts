import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("event_id");
    if (!eventId) return new Response("Missing event_id", { status: 400, headers: corsHeaders });

    const authHeader = req.headers.get("Authorization") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: ev, error: evErr } = await admin.from("events").select("id, title, host_id").eq("id", eventId).maybeSingle();
    if (evErr || !ev) return new Response("Event not found", { status: 404, headers: corsHeaders });

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (ev.host_id !== user.id && !isAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

    const { data: rsvps, error: rsvpErr } = await admin
      .from("rsvps")
      .select("id, user_id, status, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    console.log("rsvps query", { eventId, count: rsvps?.length, error: rsvpErr?.message });

    const userIds = Array.from(new Set((rsvps ?? []).map((r: any) => r.user_id)));
    const profilesMap = new Map<string, string>();
    const emailsMap = new Map<string, string>();

    if (userIds.length) {
      const { data: profs } = await admin.from("profiles").select("id, display_name").in("id", userIds);
      (profs ?? []).forEach((p: any) => profilesMap.set(p.id, p.display_name ?? ""));

      for (const uid of userIds) {
        const { data: u } = await admin.auth.admin.getUserById(uid);
        if (u?.user?.email) emailsMap.set(uid, u.user.email);
      }
    }

    const rsvpIds = (rsvps ?? []).map((r: any) => r.id);
    const checkInsMap = new Map<string, string>();
    if (rsvpIds.length) {
      const { data: cis } = await admin
        .from("check_ins")
        .select("rsvp_id, checked_in_at")
        .in("rsvp_id", rsvpIds);
      (cis ?? []).forEach((c: any) => {
        const prev = checkInsMap.get(c.rsvp_id);
        if (!prev || new Date(c.checked_in_at) < new Date(prev)) checkInsMap.set(c.rsvp_id, c.checked_in_at);
      });
    }

    const header = ["Name", "Email", "RSVP Status", "Check-in Time"];
    const lines = [header.map(csvEscape).join(",")];
    for (const r of rsvps ?? []) {
      const checkedAt = checkInsMap.get(r.id);
      lines.push([
        profilesMap.get(r.user_id) ?? "",
        emailsMap.get(r.user_id) ?? "",
        r.status,
        checkedAt ? new Date(checkedAt).toISOString() : "",
      ].map(csvEscape).join(","));
    }
    // Prepend BOM for Excel UTF-8 compatibility
    const csv = "\uFEFF" + lines.join("\r\n");

    const safeTitle = (ev.title ?? "event").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 50);
    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rsvps_${safeTitle}.csv"`,
      },
    });
  } catch (e) {
    return new Response(`Error: ${(e as Error).message}`, { status: 500, headers: corsHeaders });
  }
});
