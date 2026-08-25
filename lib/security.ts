import { pbkdf2Sync, randomBytes, createHash, timingSafeEqual } from "crypto";

const ITERATIONS = 390_000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = pbkdf2Sync(
    password,
    Buffer.from(salt, "hex"),
    ITERATIONS,
    32,
    "sha256"
  ).toString("hex");
  return `pbkdf2_sha256$${ITERATIONS}$${salt}$${digest}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 4) return false;

  const [algorithm, iterations, salt, digest] = parts;
  if (algorithm !== "pbkdf2_sha256") return false;

  const candidate = pbkdf2Sync(
    password,
    Buffer.from(salt, "hex"),
    parseInt(iterations, 10),
    32,
    "sha256"
  ).toString("hex");

  try {
    return timingSafeEqual(
      Buffer.from(candidate, "hex"),
      Buffer.from(digest, "hex")
    );
  } catch {
    return false;
  }
}

export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const PASSWORD_RULE_MESSAGE =
  "Password must be at least 8 characters and contain at least one letter and one number.";

export function validatePassword(password: string): string | null {
  if (password.length < 8) return PASSWORD_RULE_MESSAGE;
  if (!/[a-zA-Z]/.test(password)) return PASSWORD_RULE_MESSAGE;
  if (!/[0-9]/.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
}
