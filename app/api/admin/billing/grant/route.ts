import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { setPlanOverride } from "@/lib/users";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const plan = body.plan === "pro" ? "pro" : body.plan === "free" ? null : null;
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  const user = await setPlanOverride(email, plan);
  if (!user) {
    return NextResponse.json({ error: "No account with that email." }, { status: 404 });
  }
  return NextResponse.json({ user: { email: user.email, plan: user.plan } });
}
