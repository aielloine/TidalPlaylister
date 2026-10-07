// Applique prisma/migrations/*/migration.sql au démarrage du conteneur, sans le CLI Prisma (~550 Mo).
// ponytail: table de suivi maison, incompatible avec `prisma migrate status` ; utiliser le CLI si on doit
// un jour inspecter/réparer une base de prod.
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const dir = new URL("./prisma/migrations/", import.meta.url);
const db = new DatabaseSync(process.env.DATABASE_URL.replace(/^file:/, ""));
db.exec("CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
const applied = new Set(db.prepare("SELECT name FROM _app_migrations").all().map((r) => r.name));

for (const name of readdirSync(dir).filter((n) => /^\d+_/.test(n)).sort()) {
  if (applied.has(name)) continue;
  db.exec("BEGIN");
  try {
    db.exec(readFileSync(new URL(`${name}/migration.sql`, dir), "utf8"));
    db.prepare("INSERT INTO _app_migrations VALUES (?, datetime('now'))").run(name);
    db.exec("COMMIT");
    console.log(`[migrate] ${name}`);
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
db.close();
