import { NextRequest, NextResponse } from "next/server";
import { subscribeEmail } from "@/lib/newsletter";
import { isEmailConfigured } from "@/lib/mail";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { hitRateLimit } from "@/lib/rate-limit";
import { JSON_LIMIT_AUTH, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ipKey = hashIp(getClientIp(req));
    if (await hitRateLimit("newsletter_subscribe", ipKey, 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many subscribe attempts. Try again later." },
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
    const result = await subscribeEmail(email);

    if (!result.ok) {
      const status = /not configured/i.test(result.error) ? 503 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    if (process.env.NODE_ENV === "production" && !result.emailSent) {
      return NextResponse.json(
        { error: "Could not send confirmation email. Try again shortly." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      emailSent: result.emailSent,
      note: result.emailSent
        ? "Check your inbox for a confirmation link."
        : "You're on the list.",
      ...(process.env.NODE_ENV !== "production" && result.verifyUrl
        ? { verifyUrl: result.verifyUrl }
        : {}),
    });
  } catch (err) {
    console.error("newsletter subscribe:", err);
    return NextResponse.json({ error: "Subscribe failed." }, { status: 500 });
  }
}
