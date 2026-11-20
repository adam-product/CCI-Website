import { readFile } from "node:fs/promises";

const required = ["POSTGRES_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY"];
const requested = process.argv.includes("--apply");
const production = process.env.VERCEL_ENV === "production";
if (
  (requested || production) &&
  (requested || required.some((key) => process.env[key]))
) {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(
      `Set these Supabase environment variables before deploying: ${missing.join(", ")}`,
    );
    process.exitCode = 1;
  } else {
    const { default: postgres } = await import("postgres");
    const sql = postgres(process.env.POSTGRES_URL, {
      prepare: false,
      ssl: { rejectUnauthorized: true },
      max: 1,
      fetch_types: false,
      connect_timeout: 10,
    });
    try {
      const migration = await readFile(
        new URL(
          "../supabase/migrations/20261120000100_cci_cms.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await sql.unsafe(migration).simple();
      console.log("CCI database and private media bucket are ready.");
    } catch (error) {
      console.error(
        "Could not prepare Supabase. Check the connection and database permissions.",
        error?.code ?? error?.name,
      );
      process.exitCode = 1;
    } finally {
      await sql.end({ timeout: 5 });
    }
  }
}
