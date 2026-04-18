/** Remove null bytes and normalize whitespace; cap length to reduce abuse. */
export function sanitizeText(input: string, maxLen: number): string {
  const s = input.replace(/\0/g, "").trim();
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
