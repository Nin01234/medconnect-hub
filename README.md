# MedReferral (MedConnect Hub)

Hospital referral management for Ghana — clinics, hospitals, and admins. Built with **React**, **Vite**, **Tailwind**, and **Supabase**.

## Security

- **Secrets**: Never commit `.env`. Copy `.env.example` to `.env` locally. The repo ignores `.env`; only the Supabase **anon (publishable)** key belongs in the browser bundle (`VITE_SUPABASE_*`). **Do not** put the service role key in the frontend or in Vercel env vars exposed to the client.
- **Input**: Forms use Zod validation, length limits, and string sanitization; edge functions cap and validate payloads and UUIDs.
- **Errors**: Production toasts avoid leaking raw database or stack details; admin edge functions return a generic message on unexpected failures.
- **Database**: Access is enforced by Supabase **RLS** and roles — keep policies reviewed when you change the schema.
- **Dependencies**: Run `npm audit` regularly. Remaining low/moderate issues may be dev-only (e.g. Vitest/jsdom, Vite dev server); use `npm audit fix` and upgrade major versions when you can test thoroughly.

## Running locally

```bash
npm install
cp .env.example .env
# Edit .env with your Supabase project values
npm run dev
```

Required variables:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key (Settings → API) |
| `VITE_SUPABASE_PROJECT_ID` | Project ref (optional; used for display/links in some setups) |

---

## Deploy on Vercel

1. Push this repository to GitHub and import the repo in [Vercel](https://vercel.com).
2. **Framework preset**: Other, or Vite — build command `npm run build`, output directory `dist`.
3. **Environment variables** (Production & Preview): set the same three `VITE_*` variables as in `.env.example`. Do not add service role keys here for a static SPA.
4. **Supabase auth**: In Supabase → Authentication → URL configuration, add your Vercel URL (and preview URLs if needed) to **Site URL** and **Redirect URLs**.
5. Deploy. Client-side routing is handled via `vercel.json` rewrites to `index.html`.

---

## Migrating to your own Supabase project

Everything (schema, RLS, functions, triggers, storage bucket, edge functions) lives in `supabase/` and is portable.

### 1. Create a Supabase project

[https://supabase.com](https://supabase.com) → New project. Note the **Project Ref** (Settings → General).

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

### 4. Deploy the edge functions

```bash
npx supabase functions deploy admin-create-user
npx supabase functions deploy admin-manage-user
```

`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` are auto-injected by Supabase for these functions — no extra config in the dashboard for standard deploys.

### 5. Configure auth

Dashboard → Authentication → Providers: enable **Email** (optionally Google).  
Authentication → URL Configuration: add your site URL + redirect URLs (local + Vercel).

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
5. `patients`
6. `referrals`
7. `referral_attachments`, `referral_messages`, `referral_status_history`
8. `audit_logs`

---

## Project structure

- `src/pages/clinic/*` — clinic portal
- `src/pages/hospital/*` — hospital portal
- `src/pages/admin/*` — admin portal
- `src/context/AuthContext.tsx` — session + role state
- `src/components/Guards.tsx` — route protection
- `src/lib/validation.ts` — Zod schemas for user input
- `src/lib/safeError.ts` — client-safe error messages
- `supabase/migrations/` — full schema as SQL
- `supabase/functions/admin-create-user/` — service-role edge function
- `supabase/functions/admin-manage-user/` — admin user management

## Tests

```bash
npm test
```
