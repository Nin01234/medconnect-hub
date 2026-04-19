import { describe, it, expect } from "vitest";
import { sanitizeText, sanitizeOptionalText, sanitizeFileName } from "@/lib/sanitize";

describe("sanitizeText", () => {
  it("strips null bytes and trims", () => {
    expect(sanitizeText("  a\0b  ", 10)).toBe("ab");
  });

  it("removes bidi override characters", () => {
    expect(sanitizeText("safe\u202Eevil", 20)).toBe("safeevil");
  });

  it("strips simple HTML-like tags", () => {
    expect(sanitizeText("hello <b>x</b> world", 100)).toBe("hello x world");
    expect(sanitizeText("a <em>i</em> b", 100)).toBe("a i b");
  });

  it("caps length", () => {
    expect(sanitizeText("abcdefghij", 4)).toBe("abcd");
  });
});

describe("sanitizeOptionalText", () => {
  it("returns null for empty after trim", () => {
    expect(sanitizeOptionalText("   ", 10)).toBe(null);
  });
});

describe("sanitizeFileName", () => {
  it("replaces path separators", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
  });
});
