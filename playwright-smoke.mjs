import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = "http://localhost:8080";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  try {
    await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(1500);
    const authVisible = await page.locator("#identifier").isVisible().catch(() => false);
    results.push({ name: "auth page renders login identifier input", passed: authVisible });
    assert.equal(authVisible, true, "Expected #identifier input on /auth");

    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(1000);
    const loginPath = new URL(page.url()).pathname;
    const redirectedToAuth = loginPath === "/auth";
    results.push({ name: "/login redirects to /auth", passed: redirectedToAuth, detail: page.url() });
    assert.equal(redirectedToAuth, true, `Expected /login to redirect to /auth, got ${page.url()}`);

    await page.goto(`${baseUrl}/portal`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(1000);
    const portalPath = new URL(page.url()).pathname;
    const redirectedToAuthFromPortal = portalPath === "/auth";
    results.push({ name: "unauthenticated /portal redirects to /auth", passed: redirectedToAuthFromPortal, detail: page.url() });
    assert.equal(redirectedToAuthFromPortal, true, `Expected /portal to redirect to /auth, got ${page.url()}`);

    const spinnerVisible = await page.getByText("Loading…").isVisible().catch(() => false);
    results.push({ name: "auth screen not stuck at spinner", passed: !spinnerVisible });
    assert.equal(spinnerVisible, false, "Expected auth page not to stay on Loading spinner");
  } finally {
    await context.close();
    await browser.close();
  }

  console.log("PLAYWRIGHT_SMOKE_RESULTS");
  for (const result of results) {
    console.log(`${result.passed ? "PASS" : "FAIL"} - ${result.name}${result.detail ? ` (${result.detail})` : ""}`);
  }
}

run().catch((error) => {
  console.error("PLAYWRIGHT_SMOKE_FAILED");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
