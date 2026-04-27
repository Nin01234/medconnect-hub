import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 20;
const rateBucket = new Map<string, number[]>();
const INVISIBLE_AND_BIDI = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

type Payload = { identifier?: string };

function corsForRequest(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = (Deno.env.get("APP_ORIGIN") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return { ...corsHeaders, "Access-Control-Allow-Origin": "null" };
  const isAllowed = !!origin && allowed.includes(origin);
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": isAllowed ? origin : "null",
    Vary: "Origin",
  };
}

function cap(s: string, max: number): string {
  return String(s ?? "")
    .replace(/\0/g, "")
    .replace(INVISIBLE_AND_BIDI, "")
    .replace(/<[^>]{0,2000}?>/g, "")
    .trim()
    .slice(0, max);
}

function getClientIp(req: Request): string {
  const raw =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for") ||
    "unknown";
  return cap(String(raw).split(",")[0] ?? "unknown", 80).toLowerCase();
}

function enforceRateLimit(req: Request): Response | null {
  const now = Date.now();
  const key = getClientIp(req);
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

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsForRequest(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = corsForRequest(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const limit = enforceRateLimit(req);
    if (limit) return limit;

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json(req, { error: "Invalid request payload" }, 400);
    }

    const body = (await req.json()) as Payload;
    const identifier = cap(body?.identifier ?? "", 320).toLowerCase();
    if (!identifier) return json(req, { email: null });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE) return json(req, { error: "Function misconfigured" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE);
    let email: string | null = null;

    if (identifier.includes("@")) {
      const { data } = await admin
        .from("profiles")
        .select("email")
        .eq("email", identifier)
        .limit(1)
        .maybeSingle();
      email = data?.email ?? null;
    } else {
      const { data } = await admin
        .from("profiles")
        .select("email")
        .eq("username", identifier)
        .limit(1)
        .maybeSingle();
      email = data?.email ?? null;
    }

    return json(req, { email });
  } catch (_e) {
    return json(req, { error: "Internal server error" }, 500);
  }
});
