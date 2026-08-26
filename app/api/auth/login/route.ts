import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, signSessionToken, adminSessionCookieOptions } from "@/lib/auth";
import { verifyAdminCredentials } from "@/lib/auth-credentials";
import { clearLoginAttempts, isLoginRateLimited, recordFailedLogin } from "@/lib/loginAttempts";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { publicErrorMessage } from "@/lib/safe-error";
import { JSON_LIMIT_AUTH, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";

const MAX_EMAIL = 254;
const MAX_PASSWORD = 72;

export async function POST(req: NextRequest) {
  try {
    const ipHash = hashIp(getClientIp(req));

    if (await isLoginRateLimited(ipHash)) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please try again in 15 minutes." },
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

    if (
      !email ||
      !password ||
      email.length > MAX_EMAIL ||
      password.length > MAX_PASSWORD
    ) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const valid = verifyAdminCredentials(email, password);
    if (!valid) {
      await recordFailedLogin(ipHash);
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await clearLoginAttempts(ipHash);

    const token = await signSessionToken();
    const response = NextResponse.json({ success: true });

    response.cookies.set(SESSION_COOKIE, token, adminSessionCookieOptions());

    return response;
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json(
      { error: publicErrorMessage(err, "Sign in failed. Please try again.") },
      { status: 500 }
    );
  }
}
