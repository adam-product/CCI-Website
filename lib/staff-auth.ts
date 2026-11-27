import { after } from "next/server";
import {
  clientAddress,
  runtimeSetting,
  scheduleWorkerTask,
  workerOrigin,
} from "./runtime-storage";
import {
  auditStatement,
  authorize,
  bootstrapPasswordHash,
  database,
  HttpError,
  isConfiguredAdministrator,
  rateLimit,
} from "./server";
import {
  hashStaffPassword,
  makePortalToken,
  makeTemporaryPassword,
  matchesStaffPassword,
  passwordResetLifetime,
  portalSessionLifetime,
  portalSessionType,
  portalTokenDigest,
  readPortalToken,
  temporaryPasswordLifetime,
} from "./staff-password";

const roles = ["editor", "publisher", "enquiry", "super"];
const dummyHash =
  "scrypt:16384:8:5$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const normalizedEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";
const validEmail = (email: string) =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const typicalPasswords = new Set([
  "123456789012345",
  "1234567890123456",
  "123456789123456",
  "passwordpassword",
  "password12345678",
  "qwertyuiopasdfgh",
  "correcthorsebatterystaple",
]);

function validatedPassword(value: unknown, email: string, previous?: string) {
  const password = typeof value === "string" ? value.normalize("NFC") : "";
  const lowered = password.toLowerCase();
  if (
    [...password].length < 15 ||
    password.length > 256 ||
    !password.trim() ||
    password === previous ||
    lowered === email ||
    lowered === email.split("@")[0] ||
    typicalPasswords.has(lowered.trim())
  )
    throw new HttpError(
      400,
      "Choose a new password with 15–256 characters. Avoid common passwords and your email address.",
    );
  return password;
}

function auditStaffCredentialChange(actor: string, action: string, email: string) {
  return database()
    .prepare(
      `INSERT INTO audit (id,actor,action,target,created_at)
      SELECT ?,?,?,?,? WHERE changes() > 0`,
    )
    .bind(crypto.randomUUID(), actor, action, email, new Date().toISOString());
}

async function readStaffRequest(
  request: Request,
): Promise<Record<string, unknown>> {
  const mime = request.headers.get("content-type")?.split(";", 1)[0];
  const reader = request.body?.getReader();
  if (mime !== "application/json" || !reader)
    throw new HttpError(400, "Enter valid staff account details.");
  const decoder = new TextDecoder();
  let length = 0;
  let raw = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) throw new HttpError(413, "The request is too large.");
      raw += decoder.decode(value, { stream: true });
    }
    const parsed: unknown = JSON.parse(raw + decoder.decode());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new HttpError(400, "Enter valid staff account details.");
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Enter valid staff account details.");
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function saveStaffAccess(request: Request) {
  const administrator = await authorize("users");
  const {
    email: address,
    role,
    active,
    issuePassword,
    emailInvite,
    initialPassword,
  } = await readStaffRequest(request);
  const email = normalizedEmail(address);
  const manualSetup = initialPassword !== undefined;
  if (
    !validEmail(email) ||
    (role !== undefined &&
      (typeof role !== "string" ||
        !roles.includes(role) ||
        typeof active !== "boolean")) ||
    (active !== undefined && typeof active !== "boolean") ||
    (active === undefined && issuePassword !== true && emailInvite !== true) ||
    (issuePassword !== undefined && typeof issuePassword !== "boolean") ||
    (emailInvite !== undefined && typeof emailInvite !== "boolean") ||
    (emailInvite && (active === false || issuePassword)) ||
    (manualSetup && (typeof role !== "string" || issuePassword || emailInvite))
  )
    throw new HttpError(
      400,
      "Enter a valid email address, role and access status.",
    );
  if (isConfiguredAdministrator(email))
    throw new HttpError(
      400,
      "This administrator is managed in runtime configuration.",
    );
  if (
    administrator.email === email &&
    (emailInvite ||
      issuePassword ||
      active === false ||
      (role && role !== administrator.role))
  )
    throw new HttpError(
      400,
      "Ask another Super Administrator to change your access or reset your password.",
    );

  const db = database();
  const credential =
    typeof role === "string" || issuePassword || emailInvite
      ? await db
          .prepare("SELECT email_status FROM staff_credentials WHERE email=?")
          .bind(email)
          .first<{ email_status: string }>()
      : null;
  const createCredential = typeof role === "string" && !credential;
  if (manualSetup && !createCredential)
    throw new HttpError(
      409,
      "This account already has sign-in credentials. Use its existing access or password reset options.",
    );
  const manualPassword = manualSetup ? validatedPassword(initialPassword, email) : undefined;
  if (emailInvite && credential && credential.email_status !== "pending")
    throw new HttpError(
      409,
      "This staff account already has a password. Save access or use password recovery.",
    );
  if (issuePassword && credential?.email_status === "pending")
    throw new HttpError(
      409,
      "This staff member has a pending email confirmation. Resend their invitation.",
    );
  const updates = [];
  if (typeof role === "string") {
    updates.push(
      db
        .prepare(
          `INSERT INTO staff(email,role,active) VALUES (?,?,?)
      ON CONFLICT(email) DO UPDATE SET role=excluded.role,active=excluded.active
      ${manualSetup ? "WHERE NOT EXISTS (SELECT 1 FROM staff_credentials WHERE email=excluded.email)" : ""}`,
        )
        .bind(email, role, active ? 1 : 0),
    );
  } else {
    const staff = await db
      .prepare("SELECT email FROM staff WHERE email=?")
      .bind(email)
      .first();
    if (!staff) throw new HttpError(404, "Save this staff account first.");
    if (typeof active === "boolean")
      updates.push(
        db
          .prepare("UPDATE staff SET active=? WHERE email=?")
          .bind(active ? 1 : 0, email),
      );
  }
  if (emailInvite) {
    const mailer = staffMailer();
    if (!mailer)
      throw new HttpError(503, "Staff email delivery is unavailable.");
    await rateLimit(`staff-invitations:${administrator.userId}`, 20, 600);
    const token = makePortalToken();
    const results = await db.batch([
      ...updates,
      db
        .prepare(
          `INSERT INTO staff_credentials
        (email,password_hash,setup_expires_at,email_status,reset_token_hash,reset_expires_at)
        SELECT ?,?,0,'pending',?,? FROM staff WHERE email=? AND active=1
        ON CONFLICT(email) DO UPDATE SET reset_token_hash=excluded.reset_token_hash,
          reset_expires_at=excluded.reset_expires_at
        WHERE staff_credentials.email_status='pending'`,
        )
        .bind(
          email,
          dummyHash,
          portalTokenDigest(token),
          Date.now() + temporaryPasswordLifetime,
          email,
        ),
      auditStaffCredentialChange(
        administrator.email,
        "Issue staff email invitation",
        email,
      ),
    ]);
    if (!results[updates.length].meta.changes)
      throw new HttpError(
        409,
        "The account must be active and awaiting email confirmation.",
      );
    try {
      await sendStaffEmail(mailer, email, token, "invite");
    } catch {
      throw new HttpError(
        502,
        "Staff access was saved. The invitation could not be sent. Check email delivery settings, then resend the invitation.",
      );
    }
    return { ok: true, invitationSent: true };
  }
  if (issuePassword || createCredential) {
    await rateLimit(`issue-staff-password:${administrator.userId}`, 20, 600);
    const temporaryPassword = manualPassword ?? makeTemporaryPassword();
    const hash = await hashStaffPassword(temporaryPassword);
    const expiresAt = Date.now() + temporaryPasswordLifetime;
    const results = await db.batch([
      ...updates,
      db
        .prepare(
          `INSERT INTO staff_credentials(email,password_hash,setup_expires_at) VALUES (?,?,?)
        ON CONFLICT(email) ${
          issuePassword
            ? "DO UPDATE SET password_hash=excluded.password_hash, setup_expires_at=excluded.setup_expires_at, session_hash=NULL, session_expires_at=NULL, session_user_id=NULL, reset_token_hash=NULL, reset_expires_at=NULL WHERE staff_credentials.email_status<>'pending'"
            : "DO NOTHING"
        }`,
        )
        .bind(email, hash, expiresAt),
      auditStaffCredentialChange(
        administrator.email,
        manualSetup ? "Set initial portal password" : "Issue temporary portal password",
        email,
      ),
    ]);
    if (manualSetup) {
      if (!results[updates.length].meta.changes)
        throw new HttpError(409, "Another administrator has already set up this account.");
      return { ok: true };
    }
    return results[updates.length].meta.changes
      ? { ok: true, email, temporaryPassword, expiresAt }
      : { ok: true };
  }

  await db.batch([
    ...updates,
    db
      .prepare(
        `UPDATE staff_credentials SET session_hash=NULL,
      session_expires_at=NULL, session_user_id=NULL,
      reset_token_hash=NULL, reset_expires_at=NULL WHERE email=?`,
      )
      .bind(email),
    auditStatement(administrator.email, "Update staff access", email),
  ]);
  return { ok: true };
}

function localPreviewOrigin() {
  const origin = URL.parse(workerOrigin() ?? "");
  return origin && ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
    ? origin.origin
    : undefined;
}

function staffMailer() {
  const apiKey = runtimeSetting("RESEND_API_KEY");
  const sender =
    runtimeSetting("CCI_MAIL_FROM") || runtimeSetting("CCI_RESET_FROM");
  const origin = URL.parse(runtimeSetting("CCI_SITE_URL") ?? "");
  const local = localPreviewOrigin();
  if (
    !apiKey ||
    !sender ||
    !origin ||
    origin.username ||
    origin.password ||
    (local ? origin.origin !== local : origin.protocol !== "https:")
  )
    return null;
  return { apiKey, sender, link: new URL("/admin", origin) };
}

export function staffRecoveryMode() {
  if (staffMailer()) return "email";
  return localPreviewOrigin() ? "local" : "unavailable";
}

type StaffLink = "invite" | "reset";

async function sendStaffEmail(
  { apiKey, sender, link }: NonNullable<ReturnType<typeof staffMailer>>,
  email: string,
  token: string,
  purpose: StaffLink,
) {
  const invite = purpose === "invite";
  const subject = invite
    ? "Confirm your CCI staff account"
    : "Reset your CCI staff portal password";
  const instruction = invite
    ? "You’ve been invited to the CCI staff portal. Open the link to confirm your email address and choose a password."
    : "Open the link to choose a new CCI staff portal password.";
  const expiration = invite ? "24 hours" : "20 minutes";
  link.hash = `${purpose}=${token}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: [email],
      subject,
      text: `${instruction}\n\n${link.href}\n\nThis link expires in ${expiration} and can be used once. If you weren’t expecting this email, you can ignore it.`,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  await response.body?.cancel().catch(() => {});
  if (!response.ok) throw new Error("Staff email delivery failed.");
}

export async function requestStaffPasswordReset(request: Request) {
  const { email: address } = await readStaffRequest(request);
  const email = normalizedEmail(address);
  await rateLimit(
    `staff-recovery:address:${portalTokenDigest(clientAddress(request))}`,
    15,
    900,
  );
  if (!validEmail(email))
    throw new HttpError(400, "Enter a valid email address.");

  const mailer = staffMailer();
  if (!mailer)
    throw new HttpError(
      503,
      "Password reset email is unavailable. Ask a CCI Super Administrator for help.",
    );

  await rateLimit(`staff-recovery:account:${portalTokenDigest(email)}`, 3, 900);
  const sendReset = async () => {
    try {
      const token = makePortalToken();
      const result = await database()
        .prepare(
          `UPDATE staff_credentials SET reset_token_hash=?,reset_expires_at=?
          WHERE email=? AND email_status<>'pending'
          AND EXISTS (SELECT 1 FROM staff WHERE email=? AND active=1)`,
        )
        .bind(
          portalTokenDigest(token),
          Date.now() + passwordResetLifetime,
          email,
          email,
        )
        .run();
      if (!result.meta.changes) return;

      await sendStaffEmail(mailer, email, token, "reset");
    } catch {
      console.error("CCI password reset email could not be prepared or sent.");
    }
  };

  if (!scheduleWorkerTask(sendReset)) after(sendReset);
  return { ok: true };
}

export async function resetStaffPassword(
  request: Request,
  purpose: StaffLink = "reset",
) {
  const { token, newPassword } = await readStaffRequest(request);
  await rateLimit(
    `staff-reset:address:${portalTokenDigest(clientAddress(request))}`,
    15,
    900,
  );
  const invalid = () =>
    new HttpError(
      400,
      purpose === "invite"
        ? "This invitation is invalid or expired. Ask a CCI Super Administrator to resend it."
        : "This reset link is invalid or expired. Request a new link.",
    );
  if (typeof token !== "string" || !/^[\w-]{43}$/.test(token)) throw invalid();

  const tokenHash = portalTokenDigest(token);
  const db = database();
  const emailStatus =
    purpose === "invite" ? "email_status='pending'" : "email_status<>'pending'";
  const credential = await db
    .prepare(
      `SELECT email, password_hash FROM staff_credentials JOIN staff USING(email)
      WHERE reset_token_hash=? AND reset_expires_at>? AND active=1 AND ${emailStatus}`,
    )
    .bind(tokenHash, Date.now())
    .first<{ email: string; password_hash: string }>();
  if (!credential) throw invalid();

  const { email, password_hash: currentHash } = credential;
  const password = validatedPassword(newPassword, email);
  if (
    purpose === "reset" &&
    (await matchesStaffPassword(password, currentHash))
  )
    throw new HttpError(
      400,
      "Choose a password different from your current password.",
    );
  const passwordHash = await hashStaffPassword(password);
  const [updated] = await db.batch([
    db
      .prepare(
        `UPDATE staff_credentials
      SET password_hash=?,setup_expires_at=NULL,session_hash=NULL,session_expires_at=NULL,
      session_user_id=NULL,reset_token_hash=NULL,reset_expires_at=NULL,
      email_status=CASE WHEN email_status='pending' THEN 'confirmed' ELSE email_status END
      WHERE email=? AND password_hash=? AND reset_token_hash=? AND reset_expires_at>? AND ${emailStatus}
      AND EXISTS (SELECT 1 FROM staff WHERE email=? AND active=1)`,
      )
      .bind(passwordHash, email, currentHash, tokenHash, Date.now(), email),
    auditStaffCredentialChange(
      email,
      purpose === "invite" ? "Confirm staff email" : "Reset portal password",
      email,
    ),
  ]);
  if (!updated.meta.changes) throw invalid();
  return { ok: true };
}

export async function unlockStaffPortal(request: Request) {
  const body = await readStaffRequest(request);
  const email = normalizedEmail(body.email);
  const password =
    typeof body.password === "string" ? body.password.normalize("NFC") : "";
  const invalid = () =>
    new HttpError(401, "The email or password is incorrect or expired.");
  const address = portalTokenDigest(clientAddress(request));
  await rateLimit(`staff-login:address:${address}`, 40, 600);
  if (!validEmail(email) || !password || password.length > 256) throw invalid();
  await rateLimit(`staff-login:account:${portalTokenDigest(email)}`, 12, 600);
  const db = database();
  const credentials = await db
    .prepare(
      `SELECT active, password_hash, setup_expires_at FROM staff
      LEFT JOIN staff_credentials USING(email) WHERE email=?`,
    )
    .bind(email)
    .first<{
      active: number;
      password_hash: string | null;
      setup_expires_at: number | null;
    }>();
  const bootstrapHash = credentials?.password_hash
    ? undefined
    : bootstrapPasswordHash(email);
  const currentHash = credentials?.password_hash || bootstrapHash;
  const matches = await matchesStaffPassword(
    password,
    currentHash || dummyHash,
  );
  const expiry = credentials?.setup_expires_at;
  if (
    !currentHash ||
    !matches ||
    credentials?.active === 0 ||
    (typeof expiry === "number" && expiry <= Date.now())
  )
    throw invalid();

  const setup = Boolean(bootstrapHash) || typeof expiry === "number";
  if (setup && body.newPassword === undefined) return { setupRequired: true };

  let passwordHash = currentHash;
  if (setup) {
    passwordHash = await hashStaffPassword(
      validatedPassword(body.newPassword, email, password),
    );
  }

  const token = makePortalToken();
  const now = Date.now();
  const sessionHash = portalTokenDigest(token);
  if (bootstrapHash) {
    const [, created] = await db.batch([
      db
        .prepare(
          `INSERT INTO staff(email,role,active) VALUES (?,'super',1)
        ON CONFLICT(email) DO UPDATE SET role='super'
        WHERE staff.active=1 AND NOT EXISTS (SELECT 1 FROM staff_credentials WHERE email=?)`,
        )
        .bind(email, email),
      db
        .prepare(
          `INSERT INTO staff_credentials
        (email,password_hash,session_hash,session_user_id,session_expires_at)
        SELECT ?,?,?,?,? FROM staff WHERE email=? AND active=1 AND role='super'
        ON CONFLICT(email) DO NOTHING`,
        )
        .bind(
          email,
          passwordHash,
          sessionHash,
          portalSessionType,
          now + portalSessionLifetime,
          email,
        ),
    ]);
    if (!created.meta.changes) throw invalid();
    return { token };
  }
  const result = await db
    .prepare(
      `UPDATE staff_credentials
    SET password_hash=?,setup_expires_at=NULL,session_hash=?,session_user_id=?,session_expires_at=?,
    reset_token_hash=CASE WHEN setup_expires_at IS NULL THEN reset_token_hash ELSE NULL END,
    reset_expires_at=CASE WHEN setup_expires_at IS NULL THEN reset_expires_at ELSE NULL END
    WHERE email=? AND password_hash=? AND (setup_expires_at IS NULL OR setup_expires_at>?)
    AND EXISTS (SELECT 1 FROM staff WHERE email=? AND active=1)`,
    )
    .bind(
      passwordHash,
      sessionHash,
      portalSessionType,
      now + portalSessionLifetime,
      email,
      currentHash,
      now,
      email,
    )
    .run();
  if (!result.meta.changes) throw invalid();
  return { token };
}

export async function lockStaffPortal(request: Request) {
  const token = readPortalToken(request.headers.get("cookie"));
  if (token) {
    await database()
      .prepare(
        `UPDATE staff_credentials SET session_hash=NULL,
      session_expires_at=NULL,session_user_id=NULL WHERE session_hash=? AND session_user_id=?`,
      )
      .bind(portalTokenDigest(token), portalSessionType)
      .run();
  }
}
