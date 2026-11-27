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
const emailDelivery = Promise.withResolvers();
const invitations = [];
let rejectNextInvitation = false;
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
  outboundService: async (request) => {
    if (request.method !== "POST" || request.url !== "https://api.resend.com/emails")
      return new Response(null, { status: 404 });
    const message = await request.json();
    if (message.subject.startsWith("Confirm")) {
      if (rejectNextInvitation) {
        rejectNextInvitation = false;
        return new Response(null, { status: 422 });
      }
      invitations.push(message);
    } else {
      emailDelivery.resolve(message);
    }
    return Response.json({ id: "test-delivery" });
  },
  bindings: {
    CCI_ADMIN_EMAIL: admin.email,
    CCI_ADMIN_PASSWORD_HASH: await hashStaffPassword(operatorTemporary),
    CCI_SITE_URL: origin,
    RESEND_API_KEY: "re_disposable_test_key",
    CCI_RESET_FROM: "portal@example.test",
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

  const publicCopy = (await call("public")).body;
  assert.equal(
    publicCopy.find((item) => item.id === "home").title.en,
    "Click Safe. Cross Scams",
  );
  assert.equal(
    publicCopy.find((item) => item.id === "way-way-shaung").status,
    "Active",
  );
  assert.ok(
    publicCopy
      .find((item) => item.id === "about")
      .sections.find((section) => section.id === "mission").body.my,
  );
  assert.equal(
    publicCopy.find((item) => item.id === "animation-reach").value,
    "13M+",
  );
  const homeRecord = await db
    .prepare("SELECT * FROM content WHERE id='home'")
    .first();
  const legacyDraft = JSON.parse(homeRecord.draft);
  legacyDraft.title.en = "Previous homepage";
  legacyDraft.image = "/brand/cci-logo.webp";
  legacyDraft.alt = "Click Cross Initiative logo";
  await db.batch([
    db
      .prepare("UPDATE content SET draft=? WHERE id='home'")
      .bind(JSON.stringify(legacyDraft)),
    db.prepare("DELETE FROM audit WHERE action='Apply editorial brief'"),
  ]);
  await call("public");
  const revised = await db
    .prepare("SELECT draft,version FROM content WHERE id='home'")
    .first();
  assert.equal(JSON.parse(revised.draft).title.en, "Click Safe. Cross Scams");
  assert.equal(JSON.parse(revised.draft).image, "/brand/cci-logo.webp");
  assert.equal(revised.version, homeRecord.version + 1);
  await call("public");
  assert.equal(
    (await db.prepare("SELECT version FROM content WHERE id='home'").first())
      .version,
    revised.version,
  );
  console.log(
    "PASS The bilingual brief updates the public content and CMS once, preserving existing images",
  );

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

  const initiative = {
    id: "Testing",
    kind: "initiative",
    title: { en: "Testing Initiative", my: "" },
    description: { en: "Testing description", my: "" },
    image: "",
    alt: "",
    url: "",
    status: "Coming Soon",
    featured: false,
    order: 2,
    sections: [],
  };
  const createInitiative = (content) =>
    call("content", { cookie: operatorCookie, body: { content, version: 0 } });
  const created = await createInitiative(initiative);
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.id, "testing");
  const saved = (await call("content", { cookie: operatorCookie })).body.find(
    (row) => row.id === created.body.id,
  );
  assert.equal(saved.draft.id, "testing");
  assert.equal(saved.published, null);
  assert.ok(!(await call("public")).body.some((row) => row.id === "testing"));
  assert.equal((await createInitiative({ ...initiative, id: " TESTING! " })).status, 409);
  const generated = await createInitiative({ ...initiative, id: "" });
  assert.equal(generated.status, 200);
  assert.equal(generated.body.id, "testing-initiative");
  const published = await call("publish", {
    cookie: operatorCookie,
    body: { id: saved.id, version: saved.version },
  });
  assert.equal(published.status, 200, JSON.stringify(published.body));
  assert.ok((await call("public")).body.some((row) => row.id === "testing"));
  console.log("PASS New initiatives accept capitalized or blank slugs, save privately, and publish from the saved record");

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
      email_status: "manual",
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

  const manualAccount = {
    email: "manual@example.test",
    role: "editor",
    active: true,
    initialPassword: randomBytes(24).toString("base64url"),
  };
  assert.equal((await call("staff", { cookie, body: manualAccount })).status, 403);
  assert.equal((await call("staff", {
    cookie: operatorCookie,
    body: { ...manualAccount, initialPassword: "too short" },
  })).status, 400);
  const manualIssued = await call("staff", {
    cookie: operatorCookie,
    body: manualAccount,
  });
  assert.equal(manualIssued.status, 200, JSON.stringify(manualIssued.body));
  assert.deepEqual(manualIssued.body, { ok: true });
  assert.equal((await call("staff", {
    cookie: operatorCookie,
    body: { ...manualAccount, role: "super", active: false },
  })).status, 409);
  const manualFirstSignIn = await signIn(manualAccount.email, manualAccount.initialPassword);
  assert.deepEqual(manualFirstSignIn.body, { setupRequired: true });
  const manualPermanent = randomBytes(24).toString("base64url");
  assert.equal((await signIn(manualAccount.email, manualAccount.initialPassword, manualPermanent)).status, 200);
  assert.equal((await signIn(manualAccount.email, manualAccount.initialPassword)).status, 401);
  console.log("PASS Super Administrators can set an initial password without exposing it or overwriting existing credentials");

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

  const recoverySetup = await call("staff", {
    cookie: operatorCookie,
    body: { email: staff.email, issuePassword: true },
  });
  const recoveryPassword = randomBytes(24).toString("base64url");
  const existingSession = responseCookie(await signIn(staff.email, recoverySetup.body.temporaryPassword, recoveryPassword));
  assert.ok(existingSession);
  const requestReset = (email) => call("staff/forgot-password", { body: { email } });
  const known = await requestReset(staff.email);
  const unknown = await requestReset("unlisted@example.test");
  assert.equal(known.status, 202);
  assert.equal(unknown.status, known.status);
  assert.deepEqual(unknown.body, known.body);
  let timeout;
  const email = await Promise.race([
    emailDelivery.promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error("No reset email received")), 5_000);
    }),
  ]).finally(() => clearTimeout(timeout));
  assert.deepEqual(email.to, [staff.email]);
  const link = new URL(email.text.match(/https:\/\/[^\s]+/)[0]);
  assert.equal(link.origin + link.pathname, `${origin}/admin`);
  assert.equal(link.search, "");
  const token = new URLSearchParams(link.hash.slice(1)).get("reset");
  const recoveryCredential = await db
    .prepare("SELECT reset_token_hash, reset_expires_at FROM staff_credentials WHERE email=?")
    .bind(staff.email)
    .first();
  assert.equal(recoveryCredential.reset_token_hash, portalTokenDigest(token));
  assert.ok(recoveryCredential.reset_expires_at > Date.now());
  assert.equal((await call("session", { cookie: existingSession })).body.email, staff.email);

  const nextPassword = randomBytes(24).toString("base64url");
  const redeem = (resetToken, newPassword = nextPassword, from) =>
    call("staff/reset-password", { from, body: { token: resetToken, newPassword } });
  assert.equal((await redeem(token, nextPassword, "https://other.test")).status, 403);
  assert.equal((await redeem(token, "passwordpassword")).status, 400);
  const concurrentResets = await Promise.all([redeem(token), redeem(token)]);
  assert.deepEqual(concurrentResets.map((result) => result.status).sort(), [200, 400]);
  assert.equal((await redeem(token)).status, 400);
  assert.equal((await call("session", { cookie: existingSession })).body, null);
  assert.equal((await signIn(staff.email, recoveryPassword)).status, 401);
  assert.equal((await signIn(staff.email, nextPassword)).status, 200);
  const expired = randomBytes(32).toString("base64url");
  await db.prepare("UPDATE staff_credentials SET reset_token_hash=?, reset_expires_at=0 WHERE email=?")
    .bind(portalTokenDigest(expired), staff.email).run();
  assert.equal((await redeem(expired)).status, 400);
  console.log("PASS Forgot-password email, expiry, single use and session revocation");

  const invitee = "invitee@example.test";
  const invitationBody = { email: invitee, role: "editor", active: true, emailInvite: true };
  assert.equal((await call("staff", { cookie: existingSession, body: invitationBody })).status, 401);
  rejectNextInvitation = true;
  assert.equal((await call("staff", { cookie: operatorCookie, body: invitationBody })).status, 502);
  const pending = async () => (await call("staff", { cookie: operatorCookie })).body.find((row) => row.email === invitee);
  assert.equal((await pending()).email_status, "pending");
  const resend = () => call("staff", { cookie: operatorCookie, body: { email: invitee, emailInvite: true } });
  assert.deepEqual((await resend()).body, { ok: true, invitationSent: true });
  const invitationToken = (message) => {
    assert.deepEqual(message.to, [invitee]);
    const link = new URL(message.text.match(/https:\/\/[^\s]+/)[0]);
    assert.equal(link.origin + link.pathname, `${origin}/admin`);
    return new URLSearchParams(link.hash.slice(1)).get("invite");
  };
  const originalInvite = invitationToken(invitations[0]);
  assert.match(originalInvite, /^[\w-]{43}$/);
  assert.equal((await requestReset(invitee)).status, 202);
  assert.equal((await resend()).status, 200);
  const currentInvite = invitationToken(invitations[1]);
  const invitePassword = randomBytes(24).toString("base64url");
  const accept = (token) => call("staff/accept-invitation", { body: { token, newPassword: invitePassword } });
  assert.equal((await accept(originalInvite)).status, 400);
  assert.equal((await redeem(currentInvite)).status, 400);
  assert.equal((await signIn(invitee, invitePassword)).status, 401);
  assert.equal((await accept(currentInvite)).status, 200);
  assert.equal((await accept(currentInvite)).status, 400);
  assert.equal((await pending()).email_status, "confirmed");
  assert.equal((await signIn(invitee, invitePassword)).status, 200);
  assert.equal((await resend()).status, 409);
  console.log("PASS Staff invitation delivery, provider failure recovery, confirmation and sign-in");

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
