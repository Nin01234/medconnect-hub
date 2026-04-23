import type { PostgrestError } from "@supabase/supabase-js";

const GENERIC = "Something went wrong. Please try again.";

function isPostgrestError(e: unknown): e is PostgrestError {
  return typeof e === "object" && e !== null && "code" in e && "message" in e;
}

function extractErrorMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as {
    message?: unknown;
    error?: unknown;
    details?: unknown;
    context?: { status?: number; clone?: () => Response };
  };

  if (typeof e.message === "string" && e.message.trim()) return e.message;
  if (typeof e.error === "string" && e.error.trim()) return e.error;
  if (typeof e.details === "string" && e.details.trim()) return e.details;
  return null;
}

/** User-safe message for Supabase / network errors (avoids leaking schema or internals in production). */
export function safeClientError(err: unknown): string {
  if (import.meta.env.DEV) {
    if (err instanceof Error && err.message) return err.message;
    const extracted = extractErrorMessage(err);
    if (extracted) return extracted;
    return GENERIC;
  }
  if (isPostgrestError(err)) {
    if (err.code === "PGRST116") return "Record not found.";
    if (err.code === "42501" || /permission denied|row-level security/i.test(err.message ?? "")) {
      return "You do not have permission to perform this action.";
    }
    if (/jwt|expired|invalid/i.test(err.message ?? "")) return "Your session expired. Please sign in again.";
    return GENERIC;
  }
  if (err instanceof Error) {
    const m = err.message;
    if (/network|fetch|Failed to fetch/i.test(m)) return "Network error. Check your connection and try again.";
    if (m.length < 120 && !/violates|duplicate|postgres|supabase/i.test(m)) return m;
  }
  return GENERIC;
}

/** Safe message for edge-function invoke errors (redacts verbose bodies in production). */
export async function safeFunctionError(err: unknown): Promise<string> {
  const ctx = err as { context?: { status?: number; clone?: () => Response } };
  const status = ctx?.context?.status;

  // In dev, Supabase function invoke errors often surface as the generic:
  // "Edge Function returned a non-2xx status code". Prefer the response JSON.
  if (import.meta.env.DEV) {
    if (ctx?.context?.clone) {
      try {
        const payload = await ctx.context.clone().json();
        const msg =
          (typeof payload?.error === "string" && payload.error.trim() && payload.error) ||
          (typeof payload?.message === "string" && payload.message.trim() && payload.message) ||
          "";
        if (msg) return status ? `${msg} (HTTP ${status})` : msg;
      } catch {
        /* ignore */
      }
    }

    const extracted = extractErrorMessage(err);
    if (extracted) return status ? `${extracted} (HTTP ${status})` : extracted;
    if (status) return `Request failed (HTTP ${status}).`;
    return GENERIC;
  }

  if (status === 401) return "Session expired or unauthorized. Sign in again.";
  if (status === 403) return "You do not have permission for this action.";
  if (status && status >= 500) return GENERIC;
  if (ctx?.context?.clone) {
    try {
      const payload = await ctx.context.clone().json();
      const msg = typeof payload?.error === "string" ? payload.error : "";
      if (msg && msg.length < 200 && !/violates|postgres|internal/i.test(msg)) return msg;
    } catch {
      /* ignore */
    }
  }
  return GENERIC;
}
