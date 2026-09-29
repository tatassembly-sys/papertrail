import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/user-auth";
import { findUserById } from "@/lib/users";
import { createCollection, listCollections } from "@/lib/collections";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collections = await listCollections(session.userId);
  return NextResponse.json(
    { collections },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const user = await findUserById(session.userId);
  const result = await createCollection(session.userId, user, {
    name: typeof body.name === "string" ? body.name : "",
    description: typeof body.description === "string" ? body.description : "",
    public: body.public === true,
  });
  if ("error" in result) {
    return NextResponse.json(result, {
      status: result.code === "upgrade_required" ? 402 : 400,
    });
  }
  return NextResponse.json({ collection: result }, { status: 201 });
}
