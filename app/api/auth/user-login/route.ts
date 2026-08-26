import { NextRequest, NextResponse } from "next/server";
import { findUserById, verifyUserPassword } from "@/lib/users";
import { signUserToken, USER_SESSION_COOKIE, userSessionCookieOptions } from "@/lib/user-auth";
import { getClientIp, hashIp } from "@/lib/request-ip";
import {
  clearLoginAttempts,
  isLoginRateLimited,
  recordFailedLogin,
} from "@/lib/loginAttempts";
import { JSON_LIMIT_AUTH, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";

const MAX_EMAIL = 254;
const MAX_PASSWORD = 72;

export async function POST(req: NextRequest) {
  try {
    const ipHash = hashIp(getClientIp(req));
    if (await isLoginRateLimited(ipHash)) {
      return NextResponse.json(
        { error: "Too many failed sign-in attempts. Try again in 15 minutes." },
        { status: 429 }
      );
    }

    const parsed = await readJsonBody(req, JSON_LIMIT_AUTH);
    if (!parsed.ok) return parsed.response;
    const body = asRecord(parsed.value);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password || email.length > MAX_EMAIL || password.length > MAX_PASSWORD) {
      return NextResponse.json({ error: "Email and password required." }, { status: 400 });
    }

    const user = await verifyUserPassword(email, password);
    if (!user) {
      await recordFailedLogin(ipHash);
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await clearLoginAttempts(ipHash);
    const full = await findUserById(user.id);
    const token = await signUserToken(user.id, user.email, full?.token_version ?? 1);
    const res = NextResponse.json({ success: true, user });
    res.cookies.set(USER_SESSION_COOKIE, token, userSessionCookieOptions());
    return res;
  } catch (err) {
    console.error("user-login error:", err);
    return NextResponse.json({ error: "Sign in failed." }, { status: 500 });
  }
}
