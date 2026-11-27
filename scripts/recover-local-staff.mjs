import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Miniflare } from "miniflare";
import {
  hashStaffPassword,
  makePortalToken,
  passwordResetLifetime,
  portalTokenDigest,
} from "../lib/staff-password.ts";

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("Run this command in a private interactive terminal.");
  process.exit(1);
}

async function recoverLocalStaff() {
  const config = JSON.parse(
    await readFile("dist/server/wrangler.json", "utf8"),
  );
  const binding = config.d1_databases.find((item) => item.binding === "DB");
  const worker = new Miniflare({
    modules: true,
    script:
      "export default { fetch: () => new Response(null, { status: 404 }) };",
    d1Databases: { DB: binding.preview_database_id ?? binding.database_id },
    d1Persist: resolve(".wrangler/state/v3/d1"),
  });
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const db = await worker.getD1Database("DB");
    const setup = !(await db.prepare("SELECT 1 FROM staff LIMIT 1").first());
    const explicitSetup = process.argv.includes("--setup");
    if (!setup && explicitSetup) {
      console.error(
        "This preview already has staff accounts. Run the command without --setup to recover your password.",
      );
      return 1;
    }
    if (setup && !explicitSetup) {
      const answer = await terminal.question(
        "Create the first local Super Administrator? [y/N] ",
      );
      if (!/^y(?:es)?$/i.test(answer.trim())) return 0;
    }
    const email = (await terminal.question("CCI staff email: "))
      .trim()
      .toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error("Enter a valid CCI staff email address.");
      return 1;
    }

    const token = makePortalToken();
    const digest = portalTokenDigest(token);
    const expires = Date.now() + passwordResetLifetime;
    let issued;
    if (setup) {
      const unavailablePassword = await hashStaffPassword(makePortalToken());
      [, issued] = await db.batch([
        db
          .prepare(
            `INSERT INTO staff(email,role,active)
          SELECT ?,'super',1 WHERE NOT EXISTS (SELECT 1 FROM staff)`,
          )
          .bind(email),
        db
          .prepare(
            `INSERT INTO staff_credentials(email,password_hash,setup_expires_at,reset_token_hash,reset_expires_at)
          SELECT ?,?,0,?,? WHERE changes() > 0`,
          )
          .bind(email, unavailablePassword, digest, expires),
      ]);
    } else {
      issued = await db
        .prepare(
          `UPDATE staff_credentials SET reset_token_hash=?,reset_expires_at=?
        WHERE email=? AND email_status<>'pending'
        AND EXISTS (SELECT 1 FROM staff WHERE email=? AND active=1)`,
        )
        .bind(digest, expires, email, email)
        .run();
    }
    if (!issued.meta.changes) {
      console.error(
        setup
          ? "Another local account was created. Run recovery again."
          : "No active staff account with that email was found in the local preview.",
      );
      return 1;
    }
    console.log(
      "Open this private link within 20 minutes to choose your new password:",
    );
    console.log(`http://127.0.0.1:5173/admin#reset=${token}`);
    return 0;
  } finally {
    terminal.close();
    await worker.dispose();
  }
}

try {
  process.exitCode = await recoverLocalStaff();
} catch {
  console.error(
    "Could not open the local staff database. Build the preview and apply pending database migrations first.",
  );
  process.exitCode = 1;
}
