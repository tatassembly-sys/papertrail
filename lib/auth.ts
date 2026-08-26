import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "pt_session";
const SESSION_DURATION = "7d";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const MIN_SECRET_LENGTH = 32;

function getSecretKey(): Uint8Array {
  // JWT_SECRET is accepted as a deployment-friendly alias for AUTH_SECRET.
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET (or JWT_SECRET) is not set. Generate one with: openssl rand -base64 32"
    );
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters. Generate with: openssl rand -base64 32`
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecretKey());
}

/**
 * Verifies a session token. Returns true if valid admin JWT, false otherwise —
 * never throws, so callers (middleware, page guards) can use it directly
 * in a condition without a try/catch at every call site.
 */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    // Defense in depth: only accept tokens minted for admin role.
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** Shared cookie flags for admin session (login + logout). */
export function adminSessionCookieOptions(maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

