const STORAGE_PREFIX = "mc_rl:";

function readStamps(key: string): number[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function writeStamps(key: string, stamps: number[]) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(stamps));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Sliding-window limiter (per browser tab / sessionStorage). Not a substitute for
 * server-side limits; reduces noisy clients and casual abuse.
 */
export function consumeBrowserRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const stamps = readStamps(key).filter((t) => t > windowStart);
  if (stamps.length >= maxAttempts) {
    const oldest = stamps[0] ?? now;
    return { ok: false, retryAfterMs: Math.max(0, oldest + windowMs - now) };
  }
  stamps.push(now);
  writeStamps(key, stamps);
  return { ok: true };
}

export function formatRetrySeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}
