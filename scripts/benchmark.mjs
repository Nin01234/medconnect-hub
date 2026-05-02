import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const skipBuild = args.has("--skip-build");
const siteUrl = process.env.BENCHMARK_URL || "https://medconnect-hub-sigma.vercel.app";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = resolve("reports", `lighthouse-${timestamp}.json`);
const chromeProfileDir = resolve(".lighthouse", "chrome-profile");
const lighthouseTmpDir = resolve(".lighthouse", "tmp");

function run(command, commandArgs, description) {
  console.log(`\n> ${description}`);
  const result = spawnSync(command, commandArgs, {
    shell: process.platform === "win32",
    encoding: "utf8",
    env: {
      ...process.env,
      TMP: lighthouseTmpDir,
      TEMP: lighthouseTmpDir,
      TMPDIR: lighthouseTmpDir,
    },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    console.error(result.error);
    return { ok: false, output: String(result.error) };
  }

  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    status: result.status ?? 1,
  };
}

function getAudit(report, id) {
  const audit = report.audits?.[id];
  if (!audit) {
    return "n/a";
  }
  return audit.displayValue || String(audit.numericValue ?? "n/a");
}

if (!skipBuild) {
  const build = run("npm", ["run", "build"], "Building production bundle");
  if (!build.ok) process.exit(build.status);
}

mkdirSync(dirname(reportPath), { recursive: true });
mkdirSync(chromeProfileDir, { recursive: true });
mkdirSync(lighthouseTmpDir, { recursive: true });

const lighthouse = run(
  "npx",
  [
    "--yes",
    "lighthouse",
    siteUrl,
    "--quiet",
    "--chrome-flags=--headless",
    "--chrome-flags=--no-sandbox",
    "--chrome-flags=--disable-dev-shm-usage",
    "--chrome-flags=--ignore-certificate-errors",
    `--chrome-flags=--user-data-dir=${chromeProfileDir}`,
    "--only-categories=performance",
    "--output=json",
    `--output-path=${reportPath}`,
  ],
  `Running Lighthouse against ${siteUrl}`
);
if (!lighthouse.ok) {
  const isWindowsEperm = /EPERM/i.test(lighthouse.output) && /lighthouse\./i.test(lighthouse.output);
  if (!(isWindowsEperm && existsSync(reportPath))) {
    process.exit(lighthouse.status);
  }
  console.warn("\nWarning: Lighthouse reported Windows temp cleanup EPERM, but the report was generated successfully.");
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const score = report.categories?.performance?.score;
const performanceScore = typeof score === "number" ? Math.round(score * 100) : "n/a";

console.log("\nBenchmark summary");
console.log("-----------------");
console.log(`URL: ${siteUrl}`);
console.log(`Performance score: ${performanceScore}/100`);
console.log(`FCP: ${getAudit(report, "first-contentful-paint")}`);
console.log(`LCP: ${getAudit(report, "largest-contentful-paint")}`);
console.log(`Speed Index: ${getAudit(report, "speed-index")}`);
console.log(`TBT: ${getAudit(report, "total-blocking-time")}`);
console.log(`CLS: ${getAudit(report, "cumulative-layout-shift")}`);
console.log(`TTI: ${getAudit(report, "interactive")}`);
console.log(`Saved report: ${reportPath}`);
