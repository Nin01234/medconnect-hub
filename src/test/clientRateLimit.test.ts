import { describe, it, expect, beforeEach } from "vitest";
import { consumeBrowserRateLimit } from "@/lib/clientRateLimit";

describe("consumeBrowserRateLimit", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("allows attempts under the cap", () => {
    for (let i = 0; i < 3; i++) {
      expect(consumeBrowserRateLimit("test_key", 3, 60_000).ok).toBe(true);
    }
  });

  it("blocks after max within the window", () => {
    expect(consumeBrowserRateLimit("test_key2", 2, 60_000).ok).toBe(true);
    expect(consumeBrowserRateLimit("test_key2", 2, 60_000).ok).toBe(true);
    const r = consumeBrowserRateLimit("test_key2", 2, 60_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterMs).toBeGreaterThanOrEqual(0);
  });
});
