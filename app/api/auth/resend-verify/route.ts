import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getUserPublic, issueEmailVerifyToken } from "@/lib/users";
import { getSiteUrl } from "@/lib/site-url";
import { sendEmail, isEmailConfigured } from "@/lib/mail";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { hitRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipKey = hashIp(getClientIp(req));
  if (await hitRateLimit("resend_verify", ipKey, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many verification emails. Try again later." },
      { status: 429 }
    );
  }

  const profile = await getUserPublic(session.userId);
  const token = await issueEmailVerifyToken(session.userId);
  if (!token) {
    return NextResponse.json({ success: true, alreadyVerified: true });
  }

  const to = profile?.email || session.email;
  if (!to) {
    return NextResponse.json({ error: "No email on this account." }, { status: 400 });
  }

  const verifyUrl = `${getSiteUrl()}/api/auth/verify-email?token=${token}`;
  await sendEmail({
    to,
    subject: "Verify your Paper Trail account",
    html: `<p>Confirm your Paper Trail email:</p><p><a href="${verifyUrl}">Verify email</a></p>`,
    text: `Verify your email: ${verifyUrl}`,
  });

  return NextResponse.json({
    success: true,
    note: isEmailConfigured()
      ? "Check your inbox for a verification link."
      : "A verification link was generated.",
    ...(process.env.NODE_ENV !== "production" ? { verifyUrl } : {}),
  });
}
