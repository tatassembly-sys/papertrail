import { NextRequest, NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/users";
import { getSiteUrl } from "@/lib/site-url";
import { sendEmail, isEmailConfigured } from "@/lib/mail";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { hitRateLimit } from "@/lib/rate-limit";
import { JSON_LIMIT_AUTH, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ipKey = hashIp(getClientIp(req));
    if (await hitRateLimit("forgot_password", ipKey, 8, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many reset requests. Try again later." },
        { status: 429 }
      );
    }

    if (process.env.NODE_ENV === "production" && !isEmailConfigured()) {
      return NextResponse.json(
        { error: "Email delivery is not configured." },
        { status: 503 }
      );
    }

    const parsed = await readJsonBody(req, JSON_LIMIT_AUTH);
    if (!parsed.ok) return parsed.response;
    const body = asRecord(parsed.value);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.slice(0, 254) : "";
    // Always return success to avoid email enumeration
    const token = email ? await createPasswordResetToken(email) : null;
    let resetUrl: string | undefined;

    if (token) {
      resetUrl = `${getSiteUrl()}/reset-password?token=${token}`;
      const mail = await sendEmail({
        to: email.trim().toLowerCase(),
        subject: "Reset your Paper Trail password",
        html: `<p>Reset your Paper Trail password:</p><p><a href="${resetUrl}">Choose a new password</a></p><p>This link expires in 1 hour. If you did not ask for this, you can ignore the message.</p>`,
        text: `Reset your Paper Trail password (expires in 1 hour): ${resetUrl}`,
      });
      if (!mail.ok) {
        return NextResponse.json(
          { error: "Could not send the reset email. Try again later." },
          { status: 503 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      note: isEmailConfigured()
        ? "If that email exists, a reset link was sent."
        : "If that email exists, a reset link was generated.",
      ...(process.env.NODE_ENV !== "production" && resetUrl ? { resetUrl } : {}),
    });
  } catch (err) {
    console.error("forgot-password:", err);
    return NextResponse.json({ error: "Request failed." }, { status: 500 });
  }
}
