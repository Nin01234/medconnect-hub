import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  new_hospital?: { name: string; type?: string; region?: string; city?: string; address?: string; gps_code?: string; contact?: string; email?: string; departments?: string[] };
}

function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller role
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user?.id) return json({ error: 'Unauthorized: invalid or expired token' }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE);
    const [{ data: roleRows }, { data: callerProfile }] = await Promise.all([
      admin.from('user_roles').select('role').eq('user_id', callerId),
      admin.from('profiles').select('hospital_id').eq('id', callerId).maybeSingle(),
    ]);
    const callerRoles = new Set((roleRows ?? []).map((r) => r.role));
    const isAdmin = callerRoles.has('admin');
    const isHospitalAdmin = callerRoles.has('hospital_admin');
    if (!isAdmin && !isHospitalAdmin) return json({ error: 'Forbidden: admin role required' }, 403);

    const body = (await req.json()) as Payload;
    if (!body.username || !body.password || !body.full_name || !body.role) {
      return fail('Missing required fields');
    }
    if (!ALLOWED_ROLES.has(body.role)) return fail("Invalid role");
    if (body.status && !ALLOWED_STATUS.has(body.status)) return fail("Invalid status");
    if (body.email) body.email = cap(body.email.toLowerCase(), 320);
    body.username = cap(body.username.toLowerCase(), 30);
    body.full_name = cap(body.full_name, 200);
    body.password = body.password.length > 128 ? body.password.slice(0, 128) : body.password;
    if (body.phone) body.phone = cap(body.phone, 40);
    if (body.email && !isEmail(body.email)) return fail('Invalid email');
    if (!USERNAME_RE.test(body.username)) return fail('Invalid username');
    if (body.password.length < 6) return fail('Password too short');
    if (body.new_clinic) {
      body.new_clinic.name = cap(body.new_clinic.name, 200);
      if (body.new_clinic.type) body.new_clinic.type = cap(body.new_clinic.type, 120);
      if (body.new_clinic.region) body.new_clinic.region = cap(body.new_clinic.region, 120);
      if (body.new_clinic.city) body.new_clinic.city = cap(body.new_clinic.city, 120);
      if (body.new_clinic.address) body.new_clinic.address = cap(body.new_clinic.address, 500);
      if (body.new_clinic.gps_code) body.new_clinic.gps_code = cap(body.new_clinic.gps_code, 80);
      if (body.new_clinic.contact) body.new_clinic.contact = cap(body.new_clinic.contact, 40);
      if (body.new_clinic.email && !isEmail(body.new_clinic.email)) return fail('Invalid organization email');
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
      if (body.new_hospital.email && !isEmail(body.new_hospital.email)) return fail('Invalid organization email');
      if (body.new_hospital.email) body.new_hospital.email = cap(body.new_hospital.email, 320);
      if (body.new_hospital.departments) {
        body.new_hospital.departments = body.new_hospital.departments.slice(0, 20).map((d) => cap(d, 80));
      }
    }
    if (body.clinic_id && !UUID_RE.test(body.clinic_id)) return fail('Invalid clinic reference');
    if (body.hospital_id && !UUID_RE.test(body.hospital_id)) return fail('Invalid hospital reference');

    if (isHospitalAdmin) {
      const callerHospitalId = callerProfile?.hospital_id ?? null;
      if (!callerHospitalId) return fail('Hospital admin must belong to a hospital', 403);
      if (body.role !== 'hospital_staff') return fail('Hospital admins can only create hospital staff', 403);
      if (body.new_hospital || body.new_clinic || body.clinic_id) return fail('Hospital admins cannot create organizations', 403);
      if (body.hospital_id && body.hospital_id !== callerHospitalId) return fail('Hospital admins can only create staff in their own hospital', 403);
      body.hospital_id = callerHospitalId;
    }

    const resolvedEmail = body.email || fallbackEmailFromUsername(body.username);

    // Resolve clinic
    let clinic_id = body.clinic_id ?? null;
    if (body.role === 'clinic_user' && !clinic_id && body.new_clinic) {
      const { data: c, error: e } = await admin.from('clinics').insert(body.new_clinic).select('id').single();
      if (e) {
        console.error(e);
        return fail('Clinic create failed');
      }
      clinic_id = c.id;
    }

    // Resolve hospital
    let hospital_id = body.hospital_id ?? null;
    if ((body.role === 'hospital_admin' || body.role === 'hospital_staff') && !hospital_id && body.new_hospital) {
      const { data: h, error: e } = await admin.from('hospitals').insert(body.new_hospital).select('id').single();
      if (e) {
        console.error(e);
        return fail('Hospital create failed');
      }
      hospital_id = h.id;
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
      return fail('Auth create failed');
    }

    const newUserId = created.user.id;

    // Update profile (trigger created the row already)
    const { error: profileErr } = await admin.from('profiles').update({
      full_name: body.full_name,
      phone: body.phone,
      username: body.username,
      status: body.status ?? 'active',
      clinic_id,
      hospital_id,
    }).eq('id', newUserId);
    if (profileErr) {
      console.error(profileErr);
      await admin.auth.admin.deleteUser(newUserId);
      return fail('Could not create user profile');
    }

    // Replace default role
    await admin.from('user_roles').delete().eq('user_id', newUserId);
    await admin.from('user_roles').insert({ user_id: newUserId, role: body.role });

    await admin.from('audit_logs').insert({
      actor_id: callerId,
      action: 'create_user',
      entity_type: 'user',
      entity_id: newUserId,
      metadata: { role: body.role, clinic_id, hospital_id, username: body.username },
    });

    return json({ ok: true, user_id: newUserId, clinic_id, hospital_id });
  } catch (e) {
    console.error(e);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
