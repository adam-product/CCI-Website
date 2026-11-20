import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Miniflare } from "miniflare";
import { hashStaffPassword, portalTokenDigest } from "../lib/staff-password.ts";

// Use a production Worker with disposable storage and freshly generated test credentials.
const origin = "https://cci.test";
const admin = { id: "operator-test", email: "operator@example.test" };
const staff = { id: "staff-test", email: "staff@example.test" };
const operatorTemporary = randomBytes(24).toString("base64url");
const operatorPassword = randomBytes(24).toString("base64url");
const server = resolve("dist/server");
const entry = resolve(server, "index.js");
const chunks = (await readdir(server, { recursive: true, withFileTypes: true }))
  .filter((file) => file.isFile() && /\.[m]?js$/.test(file.name))
  .map((file) => resolve(file.parentPath, file.name))
  .filter((path) => path !== entry);
const worker = new Miniflare({
  modulesRoot: server,
  modules: [entry, ...chunks].map((path) => ({ type: "ESModule", path })),
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  bindings: {
    CCI_ADMIN_EMAIL: admin.email,
    CCI_ADMIN_PASSWORD_HASH: await hashStaffPassword(operatorTemporary),
  },
  d1Databases: { DB: "cci-staff-tests" },
  r2Buckets: { BUCKET: "cci-staff-tests" },
});

async function call(path, { user, body, cookie, from = origin } = {}) {
  const headers = new Headers();
  if (user) {
    headers.set("oai-authenticated-user-id", user.id);
    headers.set("oai-authenticated-user-email", user.email);
  }
  if (cookie) headers.set("cookie", cookie);
  if (body) {
    headers.set("origin", from);
    headers.set("content-type", "application/json");
  }
  const response = await worker.dispatchFetch(`${origin}/api/${path}`, {
    method: body ? "POST" : "GET",
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}

const signIn = (email, password, newPassword) =>
  call("staff/unlock", { body: { email, password, newPassword } });
const responseCookie = (result) =>
  result.headers.get("set-cookie")?.split(";")[0];

try {
  const db = await worker.getD1Database("DB");
  for (const file of (await readdir("drizzle"))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(resolve("drizzle", file), "utf8");
    await db.batch(
      sql
        .split("--> statement-breakpoint")
        .filter((part) => part.trim())
        .map((part) => db.prepare(part)),
    );
  }

  const provision = {
    email: staff.email,
    role: "publisher",
    active: true,
  };
  assert.equal((await call("staff", { body: provision })).status, 401);
  assert.equal(
    (await call("staff", { user: admin, body: provision })).status,
    401,
  );
  const bootstrap = await signIn(admin.email, operatorTemporary);
  assert.deepEqual(bootstrap.body, { setupRequired: true });
  assert.equal(responseCookie(bootstrap), undefined);
  const operator = await signIn(
    admin.email,
    operatorTemporary,
    operatorPassword,
  );
  assert.equal(operator.status, 200, JSON.stringify(operator.body));
  const operatorCookie = responseCookie(operator);
  assert.equal(
    (await call("session", { cookie: operatorCookie })).body.role,
    "super",
  );
  assert.equal((await signIn(admin.email, operatorTemporary)).status, 401);
  assert.equal(
    (
      await call("staff", {
        cookie: operatorCookie,
        body: provision,
        from: "https://other.test",
      })
    ).status,
    403,
  );
  const issued = await call("staff", {
    cookie: operatorCookie,
    body: provision,
  });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  const temporary = issued.body.temporaryPassword;
  assert.match(temporary, /^[A-Za-z0-9_-]{32}$/);
  assert.match(issued.headers.get("cache-control"), /no-store/);
  const listing = await call("staff", { cookie: operatorCookie });
  assert.deepEqual(
    listing.body.find((row) => row.email === staff.email),
    {
      email: staff.email,
      role: "publisher",
      active: 1,
      has_password: 1,
      managed: false,
    },
  );
  const credential = await db
    .prepare("SELECT password_hash FROM staff_credentials WHERE email=?")
    .bind(staff.email)
    .first();
  assert.match(credential.password_hash, /^scrypt:/);
  assert.ok(!credential.password_hash.includes(temporary));
  console.log(
    "PASS Staff access requires an authorized same-origin request and keeps credentials out of the staff list",
  );

  assert.equal((await call("session", { user: staff })).body, null);
  assert.equal((await call("content", { user: staff })).status, 401);
  assert.equal(
    (await call("staff/unlock", { body: { password: temporary } })).status,
    401,
  );
  const firstUse = await signIn(staff.email, temporary);
  assert.deepEqual(firstUse.body, { setupRequired: true });
  assert.equal(firstUse.headers.get("set-cookie"), null);
  const weak = await signIn(staff.email, temporary, "short");
  assert.equal(weak.status, 400);
  const permanent = randomBytes(24).toString("base64url");
  const unlock = await signIn(staff.email, temporary, permanent);
  assert.equal(unlock.status, 200, JSON.stringify(unlock.body));
  const setCookie = unlock.headers.get("set-cookie");
  assert.match(setCookie, /^__Host-cci-portal=/);
  assert.match(setCookie, /HttpOnly; SameSite=Strict; Secure/);
  const cookie = setCookie.split(";")[0];
  assert.equal((await call("content", { cookie })).status, 200);
  assert.equal((await call("staff", { cookie })).status, 403);
  assert.equal(
    (await call("session", { user: admin, cookie })).body.email,
    staff.email,
  );
  assert.equal((await signIn(staff.email, temporary)).status, 401);
  console.log(
    "PASS Setup requires replacement and the secure session is bound to the signed-in staff account",
  );

  await call("staff/lock", { cookie, body: {} });
  assert.equal((await call("content", { cookie })).status, 401);
  const reopened = await signIn(staff.email.toUpperCase(), permanent);
  assert.equal(reopened.body.unlocked, true);
  const reopenedCookie = responseCookie(reopened);
  await call("staff", {
    cookie: operatorCookie,
    body: { email: staff.email, active: false },
  });
  assert.equal((await call("content", { cookie: reopenedCookie })).status, 401);
  assert.equal((await signIn(staff.email, permanent)).status, 401);
  await call("staff", {
    cookie: operatorCookie,
    body: { email: staff.email, active: true },
  });
  assert.equal((await call("session", { cookie: reopenedCookie })).body, null);
  const legacyToken = randomBytes(32).toString("base64url");
  await db
    .prepare(
      "UPDATE staff_credentials SET session_hash=?,session_user_id=?,session_expires_at=? WHERE email=?",
    )
    .bind(
      portalTokenDigest(legacyToken),
      staff.id,
      Date.now() + 30_000,
      staff.email,
    )
    .run();
  assert.equal(
    (
      await call("session", {
        user: staff,
        cookie: `__Host-cci-portal=${legacyToken}`,
      })
    ).body,
    null,
  );
  const reset = await call("staff", {
    cookie: operatorCookie,
    body: { email: staff.email, issuePassword: true },
  });
  assert.equal(reset.status, 200);
  assert.equal((await signIn(staff.email, permanent)).status, 401);
  await db
    .prepare("UPDATE staff_credentials SET setup_expires_at=0 WHERE email=?")
    .bind(staff.email)
    .run();
  assert.equal(
    (await signIn(staff.email, reset.body.temporaryPassword)).status,
    401,
  );
  console.log(
    "PASS Locking, disabling, resetting and expiry invalidate the corresponding access",
  );
  for (let attempt = 0; attempt < 11; attempt++) {
    assert.equal((await signIn("unknown@example.test", permanent)).status, 401);
  }
  assert.equal((await signIn("unknown@example.test", permanent)).status, 401);
  assert.equal((await signIn("unknown@example.test", permanent)).status, 429);
  console.log("PASS Login attempts are rate limited");

  const address = (await worker.ready).origin;
  await new Promise((resolve, reject) => {
    const suite = spawn(process.execPath, ["scripts/check-cci.mjs"], {
      stdio: "inherit",
      env: {
        ...process.env,
        CCI_TEST_URL: address,
        CCI_TEST_LOGIN_EMAIL: admin.email,
        CCI_TEST_LOGIN_PASSWORD: operatorPassword,
      },
    });
    suite.on("error", reject);
    suite.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("CMS integration suite failed")),
    );
  });
} finally {
  await worker.dispose();
}
