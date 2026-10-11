import "./load-env";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { query } from "../src/lib/db";

async function main() {
  await query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const applied = new Set((await query<{ name: string }>(`select name from schema_migrations`)).map((r) => r.name));
  const dir = join(process.cwd(), "db", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file}`);
      continue;
    }
    const sqlText = readFileSync(join(dir, file), "utf8");
    const statements = sqlText
      .split(/;\s*$/m)
      .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);
    for (const stmt of statements) await query(stmt);
    await query(`insert into schema_migrations (name) values ($1)`, [file]);
    console.log(`apply  ${file} (${statements.length} statements)`);
  }
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
