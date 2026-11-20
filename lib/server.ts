import { headers } from "next/headers";
import { database, runtimeSetting, workerOrigin } from "./runtime-storage";
import {
  portalSessionType,
  portalTokenDigest,
  readPortalToken,
} from "./staff-password";
import {
  initialContent,
  rolePermissions,
  socialChannels,
  type Content,
} from "./content";
export { database };
export function siteOrigin() {
  const configured = runtimeSetting("CCI_SITE_URL");
  const vercel =
    runtimeSetting("VERCEL_PROJECT_PRODUCTION_URL") ||
    runtimeSetting("VERCEL_URL");
  return configured
    ? new URL(configured).origin
    : vercel
      ? `https://${vercel}`
      : workerOrigin() || "http://localhost:3000";
}
export async function seed() {
  const db = database();
  if (await db.prepare("SELECT id FROM content WHERE id='site'").first())
    return;
  const now = new Date().toISOString();
  await db.batch(
    initialContent.map((c) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO content (id,kind,draft,published,version,updated_at) VALUES (?,?,?,?,1,?)",
        )
        .bind(c.id, c.kind, JSON.stringify(c), JSON.stringify(c), now),
    ),
  );
}
export async function publicContent() {
  await seed();
  const { results } = await database()
    .prepare("SELECT published FROM content WHERE published IS NOT NULL")
    .all();
  return results.map((r: any) => {
    const c = JSON.parse(r.published) as Content;
    delete c.source;
    c.sections = c.sections.filter((s) => s.visible);
    return c;
  });
}
function administratorSetting(email: string) {
  return ["CCI_ADMIN", "CCI_TEST_ADMIN"].find(
    (key) =>
      email && runtimeSetting(`${key}_EMAIL`)?.trim().toLowerCase() === email,
  );
}
export function isConfiguredAdministrator(email: string) {
  return Boolean(administratorSetting(email));
}
export function bootstrapPasswordHash(email: string) {
  const key = administratorSetting(email);
  return key ? runtimeSetting(`${key}_PASSWORD_HASH`) : undefined;
}
type StaffIdentity = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  permissions: string[];
};

export async function identity(): Promise<StaffIdentity | null> {
  const token = readPortalToken((await headers()).get("cookie"));
  if (!token) return null;
  const member = await database()
    .prepare(
      `SELECT staff.email, staff.role FROM staff JOIN staff_credentials USING(email)
      WHERE session_hash=? AND session_user_id=? AND session_expires_at>?
      AND setup_expires_at IS NULL AND staff.active=1`,
    )
    .bind(portalTokenDigest(token), portalSessionType, Date.now())
    .first<{ email: string; role: string }>();
  if (!member || !Object.hasOwn(rolePermissions, member.role)) return null;
  return {
    userId: member.email,
    email: member.email,
    displayName: member.email,
    role: member.role,
    permissions: rolePermissions[member.role],
  };
}
export async function authorize(permission: string) {
  const user = await identity();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  if (!user.permissions.includes(permission))
    throw new HttpError(
      403,
      "Your account does not have access to this action.",
    );
  return user;
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const auditStatement = (actor: string, action: string, target: string) =>
  database()
    .prepare(
      "INSERT INTO audit(id,actor,action,target,created_at) VALUES (?,?,?,?,?)",
    )
    .bind(crypto.randomUUID(), actor, action, target, new Date().toISOString());
export async function rateLimit(key: string, max: number, seconds: number) {
  const now = Date.now();
  const db = database();
  const row: any = await db
    .prepare(
      "INSERT INTO limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires < ? THEN 1 ELSE count+1 END, expires=CASE WHEN expires < ? THEN ? ELSE expires END RETURNING count",
    )
    .bind(key, now + seconds * 1000, now, now, now + seconds * 1000)
    .first();
  if (row.count > max)
    throw new HttpError(429, "Too many attempts. Please try again later.");
}
export function safeURL(value: string, external = false) {
  if (!value) return true;
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value))
    return false;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"))
    return !external;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export function validateContent(c: any) {
  const locale = (v: any) =>
    v && typeof v.en === "string" && typeof v.my === "string";
  if (
    !c ||
    !locale(c.title) ||
    !locale(c.description) ||
    typeof c.image !== "string" ||
    typeof c.url !== "string" ||
    typeof c.featured !== "boolean" ||
    typeof c.alt !== "string"
  )
    throw new HttpError(400, "Invalid content fields.");
  for (const name of [
    "ctaLabel",
    "secondaryCtaLabel",
    "seoTitle",
    "seoDescription",
    "contactFormTitle",
    "contactConfirmation",
  ])
    if (c[name] !== undefined && !locale(c[name]))
      throw new HttpError(400, "Invalid translation fields.");
  if (
    [c.contactFormTitle?.en, c.contactFormTitle?.my].some(
      (value) => value?.length > 100,
    ) ||
    [c.contactConfirmation?.en, c.contactConfirmation?.my].some(
      (value) => value?.length > 300,
    )
  )
    throw new HttpError(
      400,
      "Keep the contact heading within 100 characters and the confirmation within 300.",
    );
  if (c.secondaryUrl && !safeURL(c.secondaryUrl))
    throw new HttpError(400, "Invalid secondary link.");
  if (
    !c ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.id) ||
    !["page", "initiative", "impact", "settings"].includes(c.kind)
  )
    throw new HttpError(400, "Invalid content record.");
  if (
    !c.title?.en?.trim() ||
    c.title.en.length > 200 ||
    c.title.my.length > 500 ||
    c.description.en.length > 5000 ||
    c.description.my.length > 10000
  )
    throw new HttpError(400, "Check the title and description lengths.");
  if (
    !["Active", "Coming Soon", "Completed"].includes(c.status) ||
    !safeURL(c.url, true) ||
    !safeURL(c.image) ||
    !safeURL(c.social || "", true)
  )
    throw new HttpError(400, "Use a valid status and secure HTTPS links.");
  if (
    c.email !== undefined &&
    (typeof c.email !== "string" ||
      (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)))
  )
    throw new HttpError(400, "Enter a valid public contact email.");
  if (
    c.socialLinks !== undefined &&
    (!c.socialLinks ||
      typeof c.socialLinks !== "object" ||
      Array.isArray(c.socialLinks) ||
      Object.entries(c.socialLinks).some(
        ([key, value]) =>
          !Object.hasOwn(socialChannels, key) ||
          typeof value !== "string" ||
          !safeURL(value, true),
      ))
  )
    throw new HttpError(400, "Use secure HTTPS URLs for social channels.");
  if (c.image && !c.alt?.trim())
    throw new HttpError(400, "Add alternative text for the image.");
  if (
    (c.cardImage !== undefined &&
      (c.kind !== "initiative" ||
        typeof c.cardImage !== "string" ||
        !safeURL(c.cardImage))) ||
    (c.cardAlt !== undefined &&
      (typeof c.cardAlt !== "string" || c.cardAlt.length > 500)) ||
    (c.cardImage && !c.cardAlt?.trim())
  )
    throw new HttpError(
      400,
      "Use a valid initiative card image and provide alternative text.",
    );
  if (
    !Number.isFinite(c.order) ||
    !Array.isArray(c.sections) ||
    c.sections.length > 30
  )
    throw new HttpError(400, "Invalid section list or order.");
  for (const s of c.sections)
    if (
      !s.id ||
      (s.display !== undefined &&
        !["standard", "partner", "testimonial"].includes(s.display)) ||
      !locale(s.heading) ||
      !s.heading.en ||
      !locale(s.body) ||
      !locale(s.cta) ||
      typeof s.image !== "string" ||
      typeof s.href !== "string" ||
      typeof s.visible !== "boolean" ||
      !safeURL(s.image) ||
      !safeURL(s.href) ||
      !Number.isFinite(s.order)
    )
      throw new HttpError(400, "Check section headings, text and links.");
  if (
    c.kind === "impact" &&
    (!c.source?.trim() || !c.period?.trim() || !c.value?.trim())
  )
    throw new HttpError(
      400,
      "Impact metrics need a value, reporting period and evidence source.",
    );
  if (JSON.stringify(c).length > 100000)
    throw new HttpError(400, "Content is too long.");
  return c as Content;
}
