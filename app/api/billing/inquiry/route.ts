import { NextRequest, NextResponse } from "next/server";
import { createBillingInquiry } from "@/lib/billing-inquiries";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { hitRateLimit } from "@/lib/rate-limit";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.length > 0) {
    return NextResponse.json({ success: true }, { status: 201 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const org = typeof body.org === "string" ? body.org.trim() : "";
  const seats = typeof body.seats === "string" ? body.seats.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!name || !email.includes("@") || email.length > 254 || !org) {
    return NextResponse.json(
      { error: "Name, work email, and organisation are required." },
      { status: 400 }
    );
  }

  const ipKey = hashIp(getClientIp(req));
  if (await hitRateLimit("billing_inquiry", ipKey, 3, 24 * 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "You've already sent an enquiry recently." },
      { status: 429 }
    );
  }

  await createBillingInquiry({ name, email, org, seats, note });
  return NextResponse.json({ success: true }, { status: 201 });
}
