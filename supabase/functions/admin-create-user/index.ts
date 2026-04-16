import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Payload {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  role: 'clinic_user' | 'hospital_admin' | 'hospital_staff' | 'admin';
  status?: 'active' | 'inactive';
  // org options
  clinic_id?: string | null;
  new_clinic?: { name: string; type?: string; region?: string; city?: string; address?: string; gps_code?: string; contact?: string; email?: string; ownership_type?: string };
  hospital_id?: string | null;
  new_hospital?: { name: string; type?: string; region?: string; city?: string; address?: string; gps_code?: string; contact?: string; email?: string; departments?: string[] };
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

    // Verify caller is admin
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
    const callerId = claimsData.claims.sub;

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', callerId).eq('role', 'admin').maybeSingle();
    if (!roleRow) return json({ error: 'Forbidden: admin role required' }, 403);

    const body = (await req.json()) as Payload;
    if (!body.email || !body.password || !body.full_name || !body.role) {
      return json({ error: 'Missing required fields' }, 400);
    }

    // Resolve clinic
    let clinic_id = body.clinic_id ?? null;
    if (body.role === 'clinic_user' && !clinic_id && body.new_clinic) {
      const { data: c, error: e } = await admin.from('clinics').insert(body.new_clinic).select('id').single();
      if (e) return json({ error: 'Clinic create failed: ' + e.message }, 400);
      clinic_id = c.id;
    }

    // Resolve hospital
    let hospital_id = body.hospital_id ?? null;
    if ((body.role === 'hospital_admin' || body.role === 'hospital_staff') && !hospital_id && body.new_hospital) {
      const { data: h, error: e } = await admin.from('hospitals').insert(body.new_hospital).select('id').single();
      if (e) return json({ error: 'Hospital create failed: ' + e.message }, 400);
      hospital_id = h.id;
    }

    // Create auth user (auto-confirmed)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name, phone: body.phone },
    });
    if (createErr || !created.user) return json({ error: 'Auth create failed: ' + (createErr?.message ?? '') }, 400);

    const newUserId = created.user.id;

    // Update profile (trigger created the row already)
    await admin.from('profiles').update({
      full_name: body.full_name,
      phone: body.phone,
      status: body.status ?? 'active',
      clinic_id,
      hospital_id,
    }).eq('id', newUserId);

    // Replace default role
    await admin.from('user_roles').delete().eq('user_id', newUserId);
    await admin.from('user_roles').insert({ user_id: newUserId, role: body.role });

    await admin.from('audit_logs').insert({
      actor_id: callerId,
      action: 'create_user',
      entity_type: 'user',
      entity_id: newUserId,
      metadata: { role: body.role, clinic_id, hospital_id },
    });

    return json({ ok: true, user_id: newUserId, clinic_id, hospital_id });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
