import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/users";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { hitRateLimit } from "@/lib/rate-limit";
import { JSON_LIMIT_AUTH, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ipKey = hashIp(getClientIp(req));
    if (await hitRateLimit("reset_password", ipKey, 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many reset attempts. Try again later." },
        { status: 429 }
      );
    }

    const parsed = await readJsonBody(req, JSON_LIMIT_AUTH);
    if (!parsed.ok) return parsed.response;
    const body = asRecord(parsed.value);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const token = typeof body.token === "string" ? body.token.slice(0, 128) : "";
    const password = typeof body.password === "string" ? body.password : "";
    const ok = await resetPasswordWithToken(token, password);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid or expired reset token, or password too short." },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("reset-password:", err);
    return NextResponse.json({ error: "Reset failed." }, { status: 500 });
  }
}
