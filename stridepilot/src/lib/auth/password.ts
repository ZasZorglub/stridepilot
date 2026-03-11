import crypto from "node:crypto";

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, expected] = stored.split(":");
  if (algo !== "scrypt" || !salt || !expected) return false;

  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  const left = Buffer.from(derived, "hex");
  const right = Buffer.from(expected, "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
