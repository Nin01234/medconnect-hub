import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(join(root, ".env"), "utf8");
const line = envText.split(/\r?\n/).find((l) => l.startsWith("SUPABASE_DB_PASSWORD="));
if (!line) {
  console.error("SUPABASE_DB_PASSWORD missing in .env");
  process.exit(2);
}
const password = line
  .slice("SUPABASE_DB_PASSWORD=".length)
  .trim()
  .replace(/^["']|["']$/g, "");

const r = spawnSync("npx", ["supabase", "migration", "list", "--linked", "-p", password], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
  timeout: 120_000,
  shell: true,
});

process.stdout.write(r.stdout ?? "");
process.stderr.write(r.stderr ?? "");
process.exit(r.status ?? 1);
