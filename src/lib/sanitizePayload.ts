import { sanitizeText } from "@/lib/sanitize";

/** Keys whose string values must not be altered (strip rules could change valid secrets). */
const PASSWORD_KEYS = new Set(["password", "new_password", "current_password", "old_password"]);

type Jsonish = Record<string, unknown> | unknown[] | string | number | boolean | null | undefined;

export function sanitizePayload<T extends Jsonish>(value: T, parentKey?: string): T {
  if (value == null) return value;
  if (typeof value === "string") {
    if (parentKey && PASSWORD_KEYS.has(parentKey)) return value as T;
    return sanitizeText(value, 12000) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePayload(entry)) as T;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).map(([key, v]) => [key, sanitizePayload(v as Jsonish, key)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}
