import { clientAddress } from "./runtime-storage";
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
  } = await readStaffRequest(request);
  const email = normalizedEmail(address);
  if (
    !validEmail(email) ||
    (role !== undefined &&
      (typeof role !== "string" ||
        !roles.includes(role) ||
        typeof active !== "boolean")) ||
    (active !== undefined && typeof active !== "boolean") ||
    (active === undefined && issuePassword !== true) ||
    (issuePassword !== undefined && typeof issuePassword !== "boolean")
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
    (issuePassword || active === false || (role && role !== administrator.role))
  )
    throw new HttpError(
      400,
      "Ask another Super Administrator to change your access or reset your password.",
    );

  const db = database();
  const createCredential =
    typeof role === "string" &&
    !(await db
      .prepare("SELECT email FROM staff_credentials WHERE email=?")
      .bind(email)
      .first());
  const updates = [];
  if (typeof role === "string") {
    updates.push(
      db
        .prepare(
          `INSERT INTO staff(email,role,active) VALUES (?,?,?)
      ON CONFLICT(email) DO UPDATE SET role=excluded.role,active=excluded.active`,
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
  if (issuePassword || createCredential) {
    await rateLimit(`issue-staff-password:${administrator.userId}`, 20, 600);
    const temporaryPassword = makeTemporaryPassword();
    const hash = await hashStaffPassword(temporaryPassword);
    const expiresAt = Date.now() + temporaryPasswordLifetime;
    const results = await db.batch([
      ...updates,
      db
        .prepare(
          `INSERT INTO staff_credentials(email,password_hash,setup_expires_at) VALUES (?,?,?)
        ON CONFLICT(email) ${
          issuePassword
            ? "DO UPDATE SET password_hash=excluded.password_hash, setup_expires_at=excluded.setup_expires_at, session_hash=NULL, session_expires_at=NULL, session_user_id=NULL"
            : "DO NOTHING"
        }`,
        )
        .bind(email, hash, expiresAt),
      auditStatement(
        administrator.email,
        "Issue temporary portal password",
        email,
      ),
    ]);
    return results[updates.length].meta.changes
      ? { ok: true, email, temporaryPassword, expiresAt }
      : { ok: true };
  }

  await db.batch([
    ...updates,
    db
      .prepare(
        `UPDATE staff_credentials SET session_hash=NULL,
      session_expires_at=NULL, session_user_id=NULL WHERE email=?`,
      )
      .bind(email),
    auditStatement(administrator.email, "Update staff access", email),
  ]);
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
    const next =
      typeof body.newPassword === "string"
        ? body.newPassword.normalize("NFC")
        : "";
    const lowered = next.toLowerCase();
    if (
      [...next].length < 15 ||
      next.length > 256 ||
      !next.trim() ||
      next === password ||
      lowered === email ||
      lowered === email.split("@")[0] ||
      typicalPasswords.has(lowered.trim())
    )
      throw new HttpError(
        400,
        "Choose a new password with 15–256 characters. Avoid common passwords and your email address.",
      );
    passwordHash = await hashStaffPassword(next);
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
    SET password_hash=?,setup_expires_at=NULL,session_hash=?,session_user_id=?,session_expires_at=?
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
