import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

/** True if the current request has a valid admin session cookie. */
export async function isAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/**
 * Throws-nothing guard for API routes: returns a boolean rather than a
 * NextResponse so each route can decide its own error shape/status.
 */
export async function requireAdmin(): Promise<boolean> {
  return isAdminSession();
}
