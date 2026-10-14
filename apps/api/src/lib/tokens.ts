import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 256 bits, URL-safe. Shown once, in the owner's edit link. */
export const newEditToken = () => randomBytes(32).toString("base64url");

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Constant-time comparison of a presented token with a stored hash. */
export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** IPs are only used as rate-limit keys, so store a hash rather than the address. */
export const hashIp = (ip: string) => createHash("sha256").update(`formwise:${ip}`).digest("base64url").slice(0, 22);
