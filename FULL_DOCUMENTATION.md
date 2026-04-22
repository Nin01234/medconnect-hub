# MedConnect Hub - Full Documentation

This document is the comprehensive technical and operational reference for the `medconnect-hub` application.

## 1) What this app is

MedConnect Hub is a Ghana-focused referral management platform used by:

- Clinics (create/manage referrals and communicate with hospitals)
- Hospitals (review inbound referrals, assign cases, provide feedback)
- Administrators (manage users, organizations, access, and audit records)

The app is a Vite + React SPA backed by Supabase (Auth, Postgres, RLS, Storage, Realtime, and Edge Functions).

## 2) Core capabilities

- Role-based portals: clinic, hospital, and admin
- Referral lifecycle tracking from submission to completion
- Patient-level referral history
- Referral messaging between institutions
- File attachments on referrals (private bucket access via RLS policies)
- Account approval workflow for admin-provisioned users
- Organization management (clinics/hospitals)
- Doctor management for hospitals
- Audit logging of admin actions
- Human-readable sequential IDs for key entities (`USR-*`, `CLN-*`, `HSP-*`, `DOC-*`, `RX-*`)

## 3) Technology stack

- Frontend: React 18, TypeScript, Vite
- Routing: React Router v6
- Data + cache: Supabase JS + TanStack Query
- UI: Tailwind CSS + Radix-based component system
- Validation: Zod
- Backend: Supabase Postgres + RLS + Edge Functions (Deno)
- Tests: Vitest (unit tests for sanitization currently present)
- Deployment target: Vercel (static frontend), Supabase (backend)

## 4) Repository layout

Top-level important paths:

- `src/` - frontend app
- `supabase/migrations/` - complete database schema and policy history
- `supabase/functions/` - edge functions for privileged admin actions
- `README.md` - quickstart/deploy notes
- `.env.example` - required environment variables
- `vercel.json` - SPA rewrites + security/cache headers

Frontend focus areas:

- `src/App.tsx` - app providers and complete route map
- `src/context/AuthContext.tsx` - auth session, role/profile loading, inactivity sign-out
- `src/components/Guards.tsx` - route protection (`RequireAuth`, `RequireRole`)
- `src/pages/clinic/*` - clinic portal pages
- `src/pages/hospital/*` - hospital portal pages
- `src/pages/admin/*` - admin portal pages
- `src/lib/validation.ts` - all Zod input schemas and limits
- `src/lib/sanitize.ts` - input sanitization utilities
- `src/lib/safeError.ts` - user-safe production error messaging
- `src/integrations/supabase/client.ts` - typed client + env safety checks

## 5) Environment and configuration

Required env vars (frontend):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID` (optional in some flows; kept by project)

Source: `.env.example`.

Security guardrails:

- Browser bundle must only use anon/publishable key
- Service role key must never be exposed in `VITE_*`
- `src/integrations/supabase/client.ts` blocks startup if key looks like `service_role`

## 6) Runbook: local development

1. Install dependencies:
   - `npm install`
2. Create env file:
   - copy `.env.example` to `.env`
3. Fill Supabase values in `.env`
4. Run app:
   - `npm run dev`
5. Run tests:
   - `npm test`
6. Lint:
   - `npm run lint`

Vite dev server config:

- Host: `::`
- Port: `8080`
- HMR overlay disabled

## 7) Build and deployment

Build commands:

- `npm run build` - production
- `npm run build:dev` - development mode build
- `npm run preview` - local preview

Vercel:

- SPA rewrite sends all routes to `index.html`
- Security headers include:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - strict `Permissions-Policy`
- Cache strategy:
  - `/assets/*` long immutable cache
  - `/index.html` no-cache

## 8) Authentication and authorization model

### Auth source

- Supabase Auth handles user identity and sessions.
- App loads current session and subscribes to auth state changes.

### Profile and role loading

On sign-in (or session refresh), the app loads:

- `profiles` row (user profile + org links)
- `user_roles` rows (supports multi-role but UI routes by effective role set)

### Route protection

- `RequireAuth`: user must be signed in (and active unless admin)
- `RequireRole`: user must be signed in, active unless admin, and role must match route

### Inactivity timeout

- Auto-sign-out after 5 minutes inactivity
- Activity events are throttled before timer reset to reduce overhead

### Account states

Non-admin users are blocked unless `profile.status = 'active'`.
Handled states include:

- `pending_approval`
- `active`
- `rejected`
- `suspended`

## 9) Route map

Public:

- `/` - landing page
- `/auth` - sign in
- `/terms` - terms

Authenticated entry:

- `/portal` - role/status-based redirect resolution

Clinic portal (`clinic_user`, `admin`):

- `/clinic`
- `/clinic/referrals/new`
- `/clinic/referrals`
- `/clinic/referrals/:id`
- `/clinic/patients/:patientId`
- `/clinic/messages`
- `/clinic/reset-password`

Hospital portal (`hospital_admin`, `hospital_staff`, `admin`):

- `/hospital`
- `/hospital/inbox`
- `/hospital/referrals/:id/review`
- `/hospital/patients/:patientId`
- `/hospital/assigned`
- `/hospital/feedback`
- `/hospital/doctors`
- `/hospital/messages`
- `/hospital/reset-password`

Admin portal (`admin`):

- `/admin`
- `/admin/users`
- `/admin/approvals`
- `/admin/clinics`
- `/admin/hospitals`
- `/admin/roles`
- `/admin/audit`

Fallback:

- `*` -> not found page

## 10) Data model (Supabase Postgres)

Primary enums:

- `app_role`: `admin`, `hospital_admin`, `hospital_staff`, `clinic_user`, `doctor`
- `referral_status`: draft/submitted/new/under_review/info_requested/accepted/rejected/assigned/treated/completed
- `urgency_level`: low/medium/high/critical
- `gender_type`: male/female/other
- org type enums for clinic/hospital/ownership

Core tables:

- `clinics`
- `hospitals`
- `profiles` (1:1 with `auth.users`)
- `user_roles`
- `doctors`
- `patients`
- `referrals`
- `referral_attachments`
- `referral_messages`
- `referral_status_history`
- `audit_logs`

Notable relationships:

- `profiles.clinic_id -> clinics.id`
- `profiles.hospital_id -> hospitals.id`
- `doctors.hospital_id -> hospitals.id`
- `referrals` links clinic/hospital/doctor/patient/creator
- messages/attachments/history each link to `referrals.id`

## 11) ID strategy

The system uses two identifier styles:

1. UUID primary keys (internal, relational integrity)
2. Human-readable IDs in `unique_id` columns:
   - `USR-000001`, `CLN-000001`, `HSP-000001`, `DOC-000001`, `RX-000001`

Referrals also keep legacy/reference number:

- `referral_number` format: `REF-YYYY-NNNNNN`

Sequences + triggers handle automatic assignment for new rows.

## 12) Database automation and triggers

- `update_updated_at_column()` - auto-updates `updated_at`
- `set_referral_number()` - sets referral number on insert
- `log_referral_status_change()` - appends referral status history on insert/update
- `handle_new_user()` - auto-creates profile and default `clinic_user` role at auth user creation
- `assign_unique_id()` - assigns prefixed sequential IDs by table

## 13) RLS and access control

RLS is enabled on all core public tables and storage access is policy-gated.

High-level policy behavior:

- Admin can broadly read/write protected entities
- Users can read/update own profile
- Users can read own roles; admins manage all roles
- Clinics/hospitals are globally readable by authenticated users, admin-writable
- Doctors are scoped to admin or organization visibility rules
- Referrals are visible by scoped org membership
- Referral attachments/messages/history are visible/insertable only if parent referral is visible
- Audit logs are admin-readable; inserts restricted to actor self
- Storage object access in `referral-attachments` is checked against referral scope

## 14) RPC and server-side helpers

### SQL helper functions

- `has_role(user, role)` - security-definer role check
- `current_clinic_id()` / `current_hospital_id()` - profile-linked org lookup
- `upsert_patient_for_clinic(...)` - dedupe/update-or-insert patient record, returns patient id

`upsert_patient_for_clinic` is granted to `authenticated` and enforces clinic/admin scope internally.

## 15) Edge Functions

### `admin-create-user`

Purpose:

- Admin-only user creation
- Optional inline creation of clinic/hospital records
- Assign role/status/org link
- Writes audit log entry

Security/validation behavior:

- Verifies bearer token
- Verifies caller has `admin` role
- Caps and sanitizes key text fields
- Validates email/UUIDs/role/status
- Prevents oversized payloads and malformed refs

### `admin-manage-user`

Supported actions:

- `approve_user`
- `update_user`
- `reset_password`
- `delete_user`

Behavior:

- Admin-only execution
- Validates action and fields
- Updates profile/auth records as needed
- Replaces role mapping when role changes
- Writes audit log entry for each action

## 16) Frontend data and realtime behavior

- Supabase client is typed (`Database` type)
- TanStack Query default behavior:
  - stale time: 60s
  - gc time: 5m
  - window-focus refetch disabled
  - reconnect refetch enabled
  - retry: 1
- Referral messages use Supabase Realtime channel with debounced refresh
- Realtime publication includes:
  - `referrals`
  - `referral_messages`
  - `referral_status_history`
  - `patients`

## 17) Input validation and sanitization

Validation:

- Centralized Zod schemas in `src/lib/validation.ts`
- Strong limits for names, phone, long text fields, passwords, message length
- Cross-field validation for role/org constraints in admin forms

Sanitization:

- `sanitizeText` strips null bytes, bidi/invisible chars, HTML-like tags, trims, caps length
- `sanitizeOptionalText` returns `null` for empty values
- `sanitizeFileName` blocks path-separator abuse and caps length

## 18) Error handling strategy

- `safeClientError()` redacts low-level DB/internal details in production
- `safeFunctionError()` maps edge function failures to safe user messages
- Development mode exposes more raw error details for debugging

## 19) Admin workflows

Main admin workflows include:

- Approve/reject/suspend pending accounts
- Create users with role and organization linkage
- Edit users (role, status, org links, profile fields)
- Reset credentials
- Remove users
- Manage clinic and hospital catalogs
- Manage role assignments
- Review audit trail

Every privileged user-management action is expected to create an `audit_logs` record.

## 20) Referral lifecycle (functional flow)

Typical lifecycle:

1. Clinic creates referral (patient + diagnosis + urgency + destination hospital)
2. Referral gets generated IDs and initial status history record
3. Hospital receives case in inbox
4. Hospital reviews, assigns doctor, updates status, and can add feedback
5. Clinic/hospital exchange messages and files as needed
6. Status progresses to treated/completed (or rejected/info_requested path)
7. Full timeline remains in `referral_status_history`

## 21) Security posture summary

Implemented controls:

- RLS-first access enforcement
- Role checks in SQL helpers and edge functions
- Client env guard against service role leakage
- Input schema validation + sanitization
- Safer production error redaction
- Vercel security headers
- Account status gating + inactivity auto-logout
- Audit logs for admin actions

Operational reminders:

- Never commit `.env`
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in server/edge contexts
- Review RLS after schema changes
- Run dependency audits regularly

## 22) Testing status

Current test coverage in repository includes sanitization unit tests (`src/test/sanitize.test.ts`).

Recommended additions:

- Auth/role route guard tests
- Referral status transition tests
- RLS integration tests (Supabase local stack)
- Edge function contract tests
- Critical admin workflow tests

## 23) Common maintenance tasks

### Apply latest DB migrations

- `npx supabase db push`

### Deploy admin functions

- `npx supabase functions deploy admin-create-user`
- `npx supabase functions deploy admin-manage-user`

### Promote first admin (bootstrap)

Use SQL editor to insert `admin` role in `user_roles` and remove default `clinic_user` for that account.

### Force PostgREST schema refresh

Some migrations use:

- `notify pgrst, 'reload schema';`

This is important after function/table changes exposed via PostgREST.

## 24) Known architectural boundaries

- Frontend is a pure SPA; no custom Node backend in this repo
- Privileged writes are handled by Supabase Edge Functions
- Multi-role support exists at DB level, but portal navigation is optimized around principal role pathways
- Domain logic depends heavily on RLS and DB triggers; schema changes require careful policy review

## 25) Quick start for a new engineer

1. Read `README.md` for initial setup
2. Configure `.env` and run `npm run dev`
3. Read `src/App.tsx` for route topology
4. Read `src/context/AuthContext.tsx` + `src/components/Guards.tsx` for access model
5. Read latest migrations in `supabase/migrations/` for current data/authorization rules
6. Review edge functions for admin-only operations
7. Test flows by role: clinic user, hospital staff/admin, and admin

---
