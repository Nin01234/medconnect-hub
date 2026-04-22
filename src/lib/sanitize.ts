/**
 * Plain-text hygiene for user-supplied strings before persistence or auth metadata.
 * - Strips null bytes (DB / encoding issues)
 * - Removes invisible / bidi-override characters (spoofing)
 * - Removes simple HTML-like <...> tag patterns (nested via iteration)
 * - Trims and caps length
 *
 * Passwords and secrets should not be passed through this (may alter intended characters).
 */

/** Zero-width spaces and Unicode bidi overrides often used for phishing / UI spoofing. */
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

/** Remove null bytes and normalize whitespace; cap length to reduce abuse. */
export function sanitizeText(input: string, maxLen: number): string {
  let s = input.replace(/\0/g, "").replace(INVISIBLE_AND_BIDI, "");
  s = stripHtmlLikeTags(s);
  s = s.trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

export function sanitizeOptionalText(input: string | undefined, maxLen: number): string | null {
  const t = sanitizeText(input ?? "", maxLen);
  return t === "" ? null : t;
}

export function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/\0/g, "").trim();
  return base.slice(0, 255) || "file";
}

/**
 * Sanitization for auth identifiers (email or username) before validation/auth RPC.
 * Keeps behavior predictable while removing spoofing/control characters.
 */
export function sanitizeLoginIdentifier(input: string, maxLen = 320): string {
  return sanitizeText(input, maxLen).toLowerCase();
}
