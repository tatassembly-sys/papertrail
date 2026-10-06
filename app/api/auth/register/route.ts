import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/lib/users";
import { signUserToken, USER_SESSION_COOKIE, userSessionCookieOptions } from "@/lib/user-auth";
import { getSiteUrl } from "@/lib/site-url";
import { sendEmail } from "@/lib/mail";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { hitRateLimit } from "@/lib/rate-limit";
import { JSON_LIMIT_AUTH, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ipKey = hashIp(getClientIp(req));
    if (await hitRateLimit("register", ipKey, 8, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many registration attempts. Try again later." },
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
    const name = typeof body.name === "string" ? body.name : "";

    const result = await registerUser(email, password, name);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const verifyUrl = `${getSiteUrl()}/verify-email?token=${result.verifyToken}`;

    const mail = await sendEmail({
      to: result.user.email,
      subject: "Verify your Paper Trail account",
      html: `<p>Welcome to Paper Trail.</p><p><a href="${verifyUrl}">Verify your email</a></p><p>Or open: ${verifyUrl}</p>`,
      text: `Verify your email: ${verifyUrl}`,
    });
    const emailSent = mail.ok && mail.mode === "resend";

    const token = await signUserToken(result.user.id, result.user.email, 1);
    const res = NextResponse.json({
      success: true,
      user: result.user,
      emailSent,
      ...(process.env.NODE_ENV !== "production" && !emailSent ? { verifyUrl } : {}),
      note: emailSent
        ? "Check your inbox to verify your email."
        : mail.mode === "log"
          ? "Account created. Email delivery is not configured yet."
          : "Account created, but the verification email could not be sent. Use Resend verification from your account.",
    });
    res.cookies.set(USER_SESSION_COOKIE, token, userSessionCookieOptions());
    return res;
  } catch (err) {
    console.error("register error:", err);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
