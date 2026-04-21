import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function corsForRequest(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = (Deno.env.get("APP_ORIGIN") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isAllowed = !!origin && allowed.includes(origin);
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": isAllowed ? origin : "null",
    Vary: "Origin",
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;
const ALLOWED_ACTIONS = new Set(["approve_user", "update_user", "reset_password", "delete_user"]);
const ALLOWED_ROLES = new Set(["clinic_user", "hospital_admin", "hospital_staff", "admin"]);
const ALLOWED_STATUS = new Set(["pending_approval", "active", "rejected", "suspended"]);
const INVISIBLE_AND_BIDI = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

function stripHtmlLikeTags(s: string): string {
  let out = s;
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(/<[^>]{0,2000}?>/g, "");
  }
  return out;
}

function cap(s: string, max: number): string {
  return stripHtmlLikeTags(s)
    .replace(/\0/g, "")
    .replace(INVISIBLE_AND_BIDI, "")
    .trim()
    .slice(0, max);
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
  username?: string;
  phone?: string;
  role?: "clinic_user" | "hospital_admin" | "hospital_staff" | "admin";
  status?: "pending_approval" | "active" | "rejected" | "suspended";
  clinic_id?: string | null;
  hospital_id?: string | null;
  new_password?: string;
}

function fail(req: Request, message: string, status = 400): Response {
  return json(req, { error: message }, status);
}

function isAuthNotFoundError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? "");
  return /user not found|not found/i.test(msg);
}

Deno.serve(async (req) => {
  const cors = corsForRequest(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(req, { error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user?.id) return json(req, { error: "Unauthorized: invalid or expired token" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE);
    const [{ data: roleRows }, { data: callerProfile }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", callerId),
      admin.from("profiles").select("hospital_id").eq("id", callerId).maybeSingle(),
    ]);
    const callerRoles = new Set((roleRows ?? []).map((r) => r.role));
    const isAdmin = callerRoles.has("admin");
    const isHospitalAdmin = callerRoles.has("hospital_admin");
    if (!isAdmin && !isHospitalAdmin) return json(req, { error: "Forbidden: admin role required" }, 403);

    const body = (await req.json()) as Payload;
    if (!body.user_id || !body.action) return fail(req, "Missing required fields");
    if (!ALLOWED_ACTIONS.has(body.action)) return fail(req, "Invalid action");
    if (!UUID_RE.test(body.user_id)) return fail(req, "Invalid user reference");
    if (body.full_name) body.full_name = cap(body.full_name, 200);
    if (body.username !== undefined) {
      body.username = cap(body.username.toLowerCase(), 30);
      if (!USERNAME_RE.test(body.username)) return fail(req, "Invalid username");
    }
    if (body.phone) body.phone = cap(body.phone, 40);
    if (body.email) {
      body.email = cap(body.email.toLowerCase(), 320);
      if (!isEmail(body.email)) return fail(req, "Invalid email");
    }
    if (body.role && !ALLOWED_ROLES.has(body.role)) return fail(req, "Invalid role");
    if (body.status && !ALLOWED_STATUS.has(body.status)) return fail(req, "Invalid status");
    if (body.clinic_id && !UUID_RE.test(body.clinic_id)) return fail(req, "Invalid clinic reference");
    if (body.hospital_id && !UUID_RE.test(body.hospital_id)) return fail(req, "Invalid hospital reference");

    if (isHospitalAdmin && !isAdmin) {
      const callerHospitalId = callerProfile?.hospital_id ?? null;
      if (!callerHospitalId) return fail(req, "Hospital admin must belong to a hospital", 403);

      const { data: targetProfile, error: targetProfileError } = await admin
        .from("profiles")
        .select("hospital_id")
        .eq("id", body.user_id)
        .maybeSingle();
      if (targetProfileError || !targetProfile) return fail(req, "Target user not found", 404);

      const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", body.user_id);
      const targetRoleSet = new Set((targetRoles ?? []).map((r) => r.role));
      if (targetRoleSet.has("admin") || targetRoleSet.has("hospital_admin")) {
        return fail(req, "Hospital admins cannot manage admin accounts", 403);
      }
      if (!targetRoleSet.has("hospital_staff")) return fail(req, "Hospital admins can only manage hospital staff accounts", 403);
      if (targetProfile.hospital_id !== callerHospitalId) return fail(req, "Hospital admins can only manage staff in their own hospital", 403);

      if (body.role && body.role !== "hospital_staff") return fail(req, "Hospital admins cannot change roles outside hospital staff", 403);
      if (body.hospital_id && body.hospital_id !== callerHospitalId) return fail(req, "Hospital admins cannot move staff to another hospital", 403);
      if (body.clinic_id) return fail(req, "Hospital admins cannot assign clinic links", 403);
      if (body.action === "approve_user" || body.action === "update_user") {
        body.role = "hospital_staff";
        body.hospital_id = callerHospitalId;
      }
    }

    if (body.action === "approve_user") {
      const { error } = await admin.from("profiles").update({ status: "active" }).eq("id", body.user_id);
      if (error) {
        console.error(error);
        return fail(req, "Could not approve user");
      }
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

      // Only include fields the caller actually sent, so status-only updates
      // don't accidentally overwrite profile columns with null/undefined.
      const profileUpdate: Record<string, unknown> = {};
      if (body.full_name !== undefined) profileUpdate.full_name = body.full_name;
      if (body.email !== undefined) profileUpdate.email = body.email;
      if (body.username !== undefined) profileUpdate.username = body.username;
      if (body.phone !== undefined) profileUpdate.phone = body.phone;
      if (body.status !== undefined) profileUpdate.status = body.status;
      if (body.role !== undefined) Object.assign(profileUpdate, profileOrgUpdate);

      const { error: profileError } = await admin.from("profiles").update(profileUpdate).eq("id", body.user_id);
      if (profileError) {
        console.error(profileError);
        return fail(req, "Could not update user profile");
      }

      if (body.email !== undefined) {
        const { error: authError } = await admin.auth.admin.updateUserById(body.user_id, { email: body.email });
        if (authError) {
          console.error(authError);
          return fail(req, "Could not update auth email");
        }
      }
      if (body.role) {
        await admin.from("user_roles").delete().eq("user_id", body.user_id);
        const { error: roleErr } = await admin.from("user_roles").insert({ user_id: body.user_id, role: body.role });
        if (roleErr) {
          console.error(roleErr);
          return fail(req, "Could not update user role");
        }
      }
    }

    if (body.action === "reset_password") {
      if (!body.new_password || body.new_password.length < 6) return fail(req, "Password too short");
      const pw = body.new_password.length > 128 ? body.new_password.slice(0, 128) : body.new_password;
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: pw });
      if (error) {
        console.error(error);
        if (isAuthNotFoundError(error)) return fail(req, "Target user account no longer exists", 404);
        return fail(req, "Could not reset password");
      }
    }

    if (body.action === "delete_user") {
      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) {
        console.error(error);
        return fail(req, "Could not delete user");
      }
    }

    await admin.from("audit_logs").insert({
      actor_id: callerId,
      action: body.action,
      entity_type: "user",
      entity_id: body.user_id,
      metadata: {
        role: body.role,
        status: body.status,
        username: body.username,
      },
    });

    return json(req, { ok: true });
  } catch (e) {
    console.error(e);
    return json(req, { error: "Internal server error" }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsForRequest(req), "Content-Type": "application/json" },
  });
}
