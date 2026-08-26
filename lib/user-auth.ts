import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { findUserById } from "./users";

export const USER_SESSION_COOKIE = "pt_user";
const SESSION_DURATION = "14d";
const MIN_SECRET_LENGTH = 32;

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error("AUTH_SECRET is not configured.");
  }
  return new TextEncoder().encode(secret + ":user");
}

export async function signUserToken(
  userId: string,
  email: string,
  tokenVersion = 1
): Promise<string> {
  return new SignJWT({ role: "user", sub: userId, email, tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecretKey());
}

export async function verifyUserToken(
  token: string | undefined
): Promise<{ userId: string; email: string; tokenVersion: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.role !== "user" || typeof payload.sub !== "string") return null;
    return {
      userId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
      tokenVersion: typeof payload.tv === "number" ? payload.tv : 1,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUserSession(): Promise<{
  userId: string;
  email: string;
} | null> {
  const store = await cookies();
  const token = store.get(USER_SESSION_COOKIE)?.value;
  const session = await verifyUserToken(token);
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user) return null;
  const currentVersion = user.token_version ?? 1;
  if (session.tokenVersion !== currentVersion) return null;
  return { userId: session.userId, email: session.email || user.email };
}

export function userSessionCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 14) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
