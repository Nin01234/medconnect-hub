# MedReferral

Hospital referral management system for Ghana — clinics, hospitals, and admins.
Built with React + Vite + Tailwind + Supabase.

## Running locally

```bash
npm install
npm run dev
```

App reads Supabase config from `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`).

---

## Migrating to your own Supabase project

Everything (schema, RLS, functions, triggers, storage bucket, edge function) lives in `supabase/` and is fully portable.

### 1. Create a Supabase project
<https://supabase.com> → New project. Note the **Project Ref** (Settings → General).

### 2. Update `.env`
From Settings → API:
```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
VITE_SUPABASE_PROJECT_ID=<your-ref>
```

### 3. Push the database schema
Install the [Supabase CLI](https://supabase.com/docs/guides/cli):
```bash
npx supabase login
npx supabase link --project-ref <your-ref>
npx supabase db push
```
This applies every migration in `supabase/migrations/` — tables, enums, RLS policies, helper functions (`has_role`, `current_clinic_id`, `current_hospital_id`), the `referral-attachments` storage bucket, and the auto-profile trigger.

### 4. Deploy the edge function
```bash
npx supabase functions deploy admin-create-user
```
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` are auto-injected by Supabase — no extra config needed.

### 5. Configure auth
Dashboard → Authentication → Providers: enable **Email** (optionally Google).
Authentication → URL Configuration: add your site URL + redirect URLs.

### 6. Promote your first admin
Sign up at `/auth`, then run in the Supabase SQL editor:
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'you@example.com'
ON CONFLICT DO NOTHING;

DELETE FROM public.user_roles
WHERE role = 'clinic_user'
  AND user_id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
```
Sign out and back in — `/admin` is now available.

### 7. Data migration (optional)
Export each table from your current backend (Cloud → Database → Tables → Export) and import via Supabase dashboard (Table editor → Import CSV) in this order to respect foreign keys:

1. `clinics`, `hospitals`
2. `profiles` (after corresponding `auth.users` exist — create users first via Auth dashboard or `admin-create-user`)
3. `user_roles`
4. `doctors`
5. `referrals`
6. `referral_attachments`, `referral_messages`, `referral_status_history`
7. `audit_logs`

---

## Project structure
- `src/pages/clinic/*` — clinic portal
- `src/pages/hospital/*` — hospital portal
- `src/pages/admin/*` — admin portal
- `src/context/AuthContext.tsx` — session + role state
- `src/components/Guards.tsx` — route protection
- `supabase/migrations/` — full schema as SQL
- `supabase/functions/admin-create-user/` — service-role edge function
