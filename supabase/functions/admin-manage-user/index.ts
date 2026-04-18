import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cap(s: string, max: number): string {
  return s.replace(/\0/g, "").trim().slice(0, max);
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 320;
}

type Action = "approve_user" | "update_user" | "reset_password" | "delete_user";

interface Payload {
  action: Action;
  user_id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  role?: "clinic_user" | "hospital_admin" | "hospital_staff" | "admin";
  status?: "pending_approval" | "active" | "rejected" | "suspended";
  clinic_id?: string | null;
  hospital_id?: string | null;
  new_password?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user?.id) return json({ error: "Unauthorized: invalid or expired token" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden: admin role required" }, 403);

    const body = (await req.json()) as Payload;
    if (!body.user_id || !body.action) return json({ error: "Missing required fields" }, 400);
    if (!UUID_RE.test(body.user_id)) return json({ error: "Invalid user reference" }, 400);
    if (body.full_name) body.full_name = cap(body.full_name, 200);
    if (body.phone) body.phone = cap(body.phone, 40);
    if (body.email) {
      body.email = cap(body.email.toLowerCase(), 320);
      if (!isEmail(body.email)) return json({ error: "Invalid email" }, 400);
    }
    if (body.clinic_id && !UUID_RE.test(body.clinic_id)) return json({ error: "Invalid clinic reference" }, 400);
    if (body.hospital_id && !UUID_RE.test(body.hospital_id)) return json({ error: "Invalid hospital reference" }, 400);

    if (body.action === "approve_user") {
      const { error } = await admin.from("profiles").update({ status: "active" }).eq("id", body.user_id);
      if (error) return json({ error: error.message }, 400);
    }

    if (body.action === "update_user") {
      const role = body.role;
      const profileOrgUpdate =
        role === "clinic_user"
          ? { clinic_id: body.clinic_id ?? null, hospital_id: null }
          : role === "hospital_admin" || role === "hospital_staff"
            ? { hospital_id: body.hospital_id ?? null, clinic_id: null }
            : role === "admin"
              ? { clinic_id: null, hospital_id: null }
              : {};

      const profileUpdate = {
        full_name: body.full_name,
        email: body.email,
        phone: body.phone,
        status: body.status,
        ...profileOrgUpdate,
      };
      const { error: profileError } = await admin.from("profiles").update(profileUpdate).eq("id", body.user_id);
      if (profileError) return json({ error: profileError.message }, 400);

      if (body.email) {
        const { error: authError } = await admin.auth.admin.updateUserById(body.user_id, { email: body.email });
        if (authError) return json({ error: authError.message }, 400);
      }
      if (body.role) {
        await admin.from("user_roles").delete().eq("user_id", body.user_id);
        const { error: roleErr } = await admin.from("user_roles").insert({ user_id: body.user_id, role: body.role });
        if (roleErr) return json({ error: roleErr.message }, 400);
      }
    }

    if (body.action === "reset_password") {
      if (!body.new_password || body.new_password.length < 6) return json({ error: "Password too short" }, 400);
      const pw = body.new_password.length > 128 ? body.new_password.slice(0, 128) : body.new_password;
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: pw });
      if (error) return json({ error: error.message }, 400);
    }

    if (body.action === "delete_user") {
      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) return json({ error: error.message }, 400);
    }

    await admin.from("audit_logs").insert({
      actor_id: callerId,
      action: body.action,
      entity_type: "user",
      entity_id: body.user_id,
      metadata: {
        role: body.role,
        status: body.status,
      },
    });

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
