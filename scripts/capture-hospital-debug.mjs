import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:8080";
const outPath = path.resolve(process.cwd(), "debug-overlay-11eafa.jsonl");
const overallTimeoutMs = 10 * 60_000;

function writeLine(obj) {
  fs.appendFileSync(outPath, `${JSON.stringify(obj)}\n`, "utf8");
}

async function captureOne(page, url, label) {
  console.log(`Waiting for you to open: ${url}`);
  const pre = page.locator('[data-agent-debug="11eafa"]');
  await page.waitForURL((u) => u.toString().startsWith(url), { timeout: overallTimeoutMs });
  await pre.waitFor({ timeout: overallTimeoutMs });
  const text = await pre.innerText();
  writeLine({ label, url: page.url(), capturedAt: new Date().toISOString(), text });
  console.log(`Captured ${label}`);
}

async function run() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Opening auth page. Please sign in in the opened browser window.");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Output file: ${outPath}`);

  await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded", timeout: 30_000 });

  console.log("After signing in, manually open these URLs in the SAME window:");
  console.log(`1) ${baseUrl}/hospital/dashboard?debug=11eafa`);
  console.log(`2) ${baseUrl}/hospital/inbox?debug=11eafa`);

  await captureOne(page, `${baseUrl}/hospital/dashboard?debug=11eafa`, "hospital-dashboard");
  await captureOne(page, `${baseUrl}/hospital/inbox?debug=11eafa`, "hospital-inbox");

  await context.close();
  await browser.close();
}

run().catch((err) => {
  console.error(err?.stack || err);
  process.exitCode = 1;
});

