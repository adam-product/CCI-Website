import { Buffer } from "node:buffer";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const format = "scrypt:16384:8:5";
const hashOptions = { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 };
const development = process.env.NODE_ENV === "development";
const cookieName = development ? "cci-portal-dev" : "__Host-cci-portal";

export const portalSessionType = "cci-password-v1";
export const temporaryPasswordLifetime = 24 * 60 * 60 * 1000;
export const portalSessionLifetime = 4 * 60 * 60 * 1000;
export const makeTemporaryPassword = () =>
  randomBytes(24).toString("base64url");
export const makePortalToken = () => randomBytes(32).toString("base64url");

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 32, hashOptions, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashStaffPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `${format}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function matchesStaffPassword(password: string, hash: string) {
  const [version, encodedSalt, encodedKey] = hash.split("$");
  if (version !== format || !encodedSalt || !encodedKey) return false;
  const salt = Buffer.from(encodedSalt, "base64url");
  const expected = Buffer.from(encodedKey, "base64url");
  if (salt.length !== 16 || expected.length !== 32) return false;
  return timingSafeEqual(await deriveKey(password, salt), expected);
}

export function portalTokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readPortalToken(header: string | null) {
  const matches = (header || "")
    .split(";")
    .map((value) => value.trim())
    .filter((value) => value.startsWith(`${cookieName}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(cookieName.length + 1);
  return /^[\w-]{43}$/.test(token) ? token : null;
}

export function portalCookie(token = "") {
  const age = token ? portalSessionLifetime / 1000 : 0;
  return `${cookieName}=${token}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Strict${development ? "" : "; Secure"}`;
}
