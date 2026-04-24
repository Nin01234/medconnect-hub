import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 12;
const MAX_BODY_BYTES = 50_000;
const rateBucket = new Map<string, number[]>();

function corsForRequest(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = (Deno.env.get("APP_ORIGIN") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return { ...corsHeaders, "Access-Control-Allow-Origin": "null" };

  const isVercelPreview = !!origin && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
  const isAllowed = !!origin && (allowed.includes(origin) || isVercelPreview);
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": isAllowed ? origin : "null",
    Vary: "Origin",
  };
}

function getClientIp(req: Request): string {
  const raw =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for") ||
    "unknown";
  return cap(String(raw).split(",")[0] ?? "unknown", 80).toLowerCase();
}

function enforceRateLimit(req: Request, callerId: string): Response | null {
  const now = Date.now();
  const key = `${callerId}:${getClientIp(req)}`;
  const recent = (rateBucket.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_REQUESTS) {
    return json(req, { error: "Too many requests. Please wait and try again." }, 429);
  }
  recent.push(now);
  rateBucket.set(key, recent);
  for (const [bucketKey, timestamps] of rateBucket.entries()) {
    const kept = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (kept.length === 0) rateBucket.delete(bucketKey);
    else if (kept.length !== timestamps.length) rateBucket.set(bucketKey, kept);
  }
  return null;
}

async function parsePayload(req: Request): Promise<Payload> {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("Payload too large");
  }
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Invalid content type");
  }
  const body = (await req.json()) as Payload;
  if (!body || typeof body !== "object") throw new Error("Invalid request payload");
  return body;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;
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

function fallbackEmailFromUsername(username: string): string {
  return `${username}@user.medconnect.local`;
}

interface Payload {
  full_name: string;
  email?: string;
  username: string;
  phone?: string;
  password: string;
  role: 'clinic_user' | 'hospital_admin' | 'hospital_staff' | 'admin';
  status?: 'pending_approval' | 'active' | 'rejected' | 'suspended';
  // org options
  clinic_id?: string | null;
  new_clinic?: { name: string; type?: string; region?: string; city?: string; address?: string; gps_code?: string; contact?: string; email?: string; ownership_type?: string };
  hospital_id?: string | null;
  department_id?: string | null;
  staff_id?: string;
  new_hospital?: { name: string; type?: string; region?: string; city?: string; address?: string; gps_code?: string; contact?: string; email?: string; departments?: string[] };
}

function fail(req: Request, message: string, status = 400): Response {
  return json(req, { error: message }, status);
}

function isDuplicateError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? "");
  return /duplicate key|already exists|unique constraint|already registered/i.test(msg);
}

function isAuthUserExistsError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? "");
  return /already been registered|already exists|user already registered/i.test(msg);
}

function safeAuthErrorMessage(error: unknown): string | null {
  const msg = String((error as { message?: string })?.message ?? "").trim();
  if (!msg) return null;
  if (/database|postgres|internal|sql/i.test(msg)) return null;
  if (msg.length > 220) return null;
  return msg;
}

Deno.serve(async (req) => {
  const cors = corsForRequest(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json(req, { error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const ANON = Deno.env.get('SUPABASE_ANON_KEY');
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL) return fail(req, "Function misconfigured: missing SUPABASE_URL", 500);
    if (!ANON) return fail(req, "Function misconfigured: missing SUPABASE_ANON_KEY", 500);
    if (!SERVICE) return fail(req, "Function misconfigured: missing SUPABASE_SERVICE_ROLE_KEY", 500);

    // Verify caller role
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user?.id) return json(req, { error: "Unauthorized: invalid or expired token" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE);
    const [{ data: roleRows }, { data: callerProfile }] = await Promise.all([
      admin.from('user_roles').select('role').eq('user_id', callerId),
      admin.from('profiles').select('hospital_id').eq('id', callerId).maybeSingle(),
    ]);
    const callerRoles = new Set((roleRows ?? []).map((r) => r.role));
    const isAdmin = callerRoles.has('admin');
    const isHospitalAdmin = callerRoles.has('hospital_admin');
    if (!isAdmin && !isHospitalAdmin) return json(req, { error: "Forbidden: admin role required" }, 403);

    const limit = enforceRateLimit(req, callerId);
    if (limit) return limit;

    const body = await parsePayload(req);
    if (!body.username || !body.password || !body.full_name || !body.role) {
      return fail(req, "Missing required fields");
    }
    if (!ALLOWED_ROLES.has(body.role)) return fail(req, "Invalid role");
    if (body.status && !ALLOWED_STATUS.has(body.status)) return fail(req, "Invalid status");
    if (body.email) body.email = cap(body.email.toLowerCase(), 320);
    body.username = cap(body.username.toLowerCase(), 30);
    body.full_name = cap(body.full_name, 200);
    body.password = body.password.length > 128 ? body.password.slice(0, 128) : body.password;
    if (body.phone) body.phone = cap(body.phone, 40);
    if (body.email && !isEmail(body.email)) return fail(req, "Invalid email");
    if (!USERNAME_RE.test(body.username)) return fail(req, "Invalid username");
    if (body.password.length < 6) return fail(req, "Password too short");
    if (body.new_clinic) {
      body.new_clinic.name = cap(body.new_clinic.name, 200);
      if (body.new_clinic.type) body.new_clinic.type = cap(body.new_clinic.type, 120);
      if (body.new_clinic.region) body.new_clinic.region = cap(body.new_clinic.region, 120);
      if (body.new_clinic.city) body.new_clinic.city = cap(body.new_clinic.city, 120);
      if (body.new_clinic.address) body.new_clinic.address = cap(body.new_clinic.address, 500);
      if (body.new_clinic.gps_code) body.new_clinic.gps_code = cap(body.new_clinic.gps_code, 80);
      if (body.new_clinic.contact) body.new_clinic.contact = cap(body.new_clinic.contact, 40);
      if (body.new_clinic.email && !isEmail(body.new_clinic.email)) return fail(req, "Invalid organization email");
      if (body.new_clinic.email) body.new_clinic.email = cap(body.new_clinic.email, 320);
    }
    if (body.new_hospital) {
      body.new_hospital.name = cap(body.new_hospital.name, 200);
      if (body.new_hospital.type) body.new_hospital.type = cap(body.new_hospital.type, 120);
      if (body.new_hospital.region) body.new_hospital.region = cap(body.new_hospital.region, 120);
      if (body.new_hospital.city) body.new_hospital.city = cap(body.new_hospital.city, 120);
      if (body.new_hospital.address) body.new_hospital.address = cap(body.new_hospital.address, 500);
      if (body.new_hospital.gps_code) body.new_hospital.gps_code = cap(body.new_hospital.gps_code, 80);
      if (body.new_hospital.contact) body.new_hospital.contact = cap(body.new_hospital.contact, 40);
      if (body.new_hospital.email && !isEmail(body.new_hospital.email)) return fail(req, "Invalid organization email");
      if (body.new_hospital.email) body.new_hospital.email = cap(body.new_hospital.email, 320);
      if (body.new_hospital.departments) {
        body.new_hospital.departments = body.new_hospital.departments.slice(0, 20).map((d) => cap(d, 80));
      }
    }
    if (body.clinic_id && !UUID_RE.test(body.clinic_id)) return fail(req, "Invalid clinic reference");
    if (body.hospital_id && !UUID_RE.test(body.hospital_id)) return fail(req, "Invalid hospital reference");
    if (body.department_id && !UUID_RE.test(body.department_id)) return fail(req, "Invalid department reference");
    if (body.staff_id !== undefined) body.staff_id = cap(body.staff_id, 50);

    if (isHospitalAdmin) {
      const callerHospitalId = callerProfile?.hospital_id ?? null;
      if (!callerHospitalId) return fail(req, "Hospital admin must belong to a hospital", 403);
      if (body.role !== "hospital_staff") return fail(req, "Hospital admins can only create hospital staff", 403);
      if (body.new_hospital || body.new_clinic || body.clinic_id) return fail(req, "Hospital admins cannot create organizations", 403);
      if (body.hospital_id && body.hospital_id !== callerHospitalId) return fail(req, "Hospital admins can only create staff in their own hospital", 403);
      if (!body.department_id) return fail(req, "Department is required for hospital staff");
      if (!body.staff_id || !body.staff_id.trim()) return fail(req, "Staff ID is required");
      body.hospital_id = callerHospitalId;
    }

    if (body.role === "hospital_admin" && !body.hospital_id && !body.new_hospital) {
      return fail(req, "Hospital is required for hospital admin");
    }

    const resolvedEmail = body.email || fallbackEmailFromUsername(body.username);

    // Resolve clinic
    let clinic_id = body.clinic_id ?? null;
    if (body.role === 'clinic_user' && !clinic_id && body.new_clinic) {
      const { data: c, error: e } = await admin.from('clinics').insert(body.new_clinic).select('id').single();
      if (e) {
        console.error(e);
        return fail(req, "Clinic create failed");
      }
      clinic_id = c.id;
    }

    // Resolve hospital
    let hospital_id = body.hospital_id ?? null;
    if ((body.role === 'hospital_admin' || body.role === 'hospital_staff') && !hospital_id && body.new_hospital) {
      const { departments: requestedDepartments, ...hospitalInsert } = body.new_hospital;
      const { data: h, error: e } = await admin.from('hospitals').insert(hospitalInsert).select('id').single();
      if (e) {
        console.error(e);
        return fail(req, "Hospital create failed");
      }
      hospital_id = h.id;
      if ((requestedDepartments ?? []).length > 0) {
        const departmentRows = requestedDepartments
          .map((name) => cap(name, 80))
          .filter(Boolean)
          .slice(0, 20)
          .map((name) => ({ hospital_id, name, status: "active" }));
        if (departmentRows.length > 0) {
          const { error: depInsertErr } = await admin.from("departments").insert(departmentRows);
          if (depInsertErr) {
            console.error(depInsertErr);
            return fail(req, "Hospital created but departments could not be added");
          }
        }
      }
    }
    if (body.role === "hospital_staff") {
      if (!hospital_id) return fail(req, "Hospital is required for staff");
      if (!body.department_id) return fail(req, "Department is required for hospital staff");
      if (!body.staff_id || !body.staff_id.trim()) return fail(req, "Staff ID is required");
      const { data: dep } = await admin
        .from("departments")
        .select("id,hospital_id")
        .eq("id", body.department_id ?? "")
        .maybeSingle();
      if (!dep || dep.hospital_id !== hospital_id) return fail(req, "Department does not belong to this hospital");
    }

    // Create auth user (auto-confirmed)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: resolvedEmail,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name, phone: body.phone, username: body.username },
    });
    if (createErr || !created.user) {
      console.error(createErr);
      if (isDuplicateError(createErr)) {
        return fail(req, "A user with this email or username already exists", 409);
      }
      const authMsg = safeAuthErrorMessage(createErr);
      if (authMsg) return fail(req, authMsg);
      return fail(req, "Could not create user account");
    }

    const newUserId = created.user.id;

    // Update profile (trigger created the row already)
    // Keep updates minimal so older schemas (missing optional columns) don't hard-fail.
    const profileUpdate: Record<string, unknown> = {
      full_name: body.full_name,
      phone: body.phone,
      username: body.username,
      status: body.status ?? "active",
      clinic_id,
      hospital_id,
    };
    if (body.role === "hospital_staff") {
      profileUpdate.department_id = body.department_id ?? null;
      profileUpdate.staff_id = body.staff_id?.trim() || null;
    }

    const { error: profileErr } = await admin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", newUserId);
    if (profileErr) {
      console.error(profileErr);
      await admin.auth.admin.deleteUser(newUserId);
      if (isDuplicateError(profileErr)) {
        return fail(req, "Username is already in use. Try a different one.", 409);
      }
      return fail(req, "Could not create user profile");
    }

    if (body.role === "hospital_staff") {
      const { data: createdProfile, error: createdProfileErr } = await admin
        .from("profiles")
        .select("department_id, staff_id")
        .eq("id", newUserId)
        .maybeSingle();
      if (createdProfileErr) {
        console.error(createdProfileErr);
        await admin.auth.admin.deleteUser(newUserId);
        return fail(req, "Could not verify staff profile fields");
      }
      if (!createdProfile?.department_id || !createdProfile?.staff_id) {
        await admin.auth.admin.deleteUser(newUserId);
        return fail(req, "Staff ID or department was not saved correctly");
      }
    }

    // Replace default role
    const { error: roleDeleteErr } = await admin.from('user_roles').delete().eq('user_id', newUserId);
    if (roleDeleteErr) {
      console.error(roleDeleteErr);
      await admin.auth.admin.deleteUser(newUserId);
      return fail(req, "Could not assign user role");
    }
    const { error: roleInsertErr } = await admin.from('user_roles').insert({ user_id: newUserId, role: body.role });
    if (roleInsertErr) {
      console.error(roleInsertErr);
      await admin.auth.admin.deleteUser(newUserId);
      if (isDuplicateError(roleInsertErr) || isAuthUserExistsError(roleInsertErr)) {
        return fail(req, "A conflicting user role already exists. Try again.", 409);
      }
      return fail(req, "Could not assign user role");
    }

    await admin.from('audit_logs').insert({
      actor_id: callerId,
      action: 'create_user',
      entity_type: 'user',
      entity_id: newUserId,
      metadata: {
        role: body.role,
        clinic_id,
        hospital_id,
        department_id: body.department_id ?? null,
        staff_id: body.staff_id?.trim() || null,
        username: body.username,
      },
    });

    return json(req, { ok: true, user_id: newUserId, clinic_id, hospital_id });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "";
    if (message === "Payload too large") return json(req, { error: "Payload too large" }, 413);
    if (message === "Invalid content type" || message === "Invalid request payload") {
      return json(req, { error: "Invalid request payload" }, 400);
    }
    return json(req, { error: "Internal server error" }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsForRequest(req), "Content-Type": "application/json" },
  });
}
