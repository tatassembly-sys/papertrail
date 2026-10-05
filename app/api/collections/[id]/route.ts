import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/user-auth";
import { findUserById } from "@/lib/users";
import { deleteCollection, getCollection, updateCollection } from "@/lib/collections";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const row = await getCollection(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.public) {
    return NextResponse.json({
      collection: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        slugs: row.slugs,
        public: row.public,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  }
  const session = await getCurrentUserSession();
  if (!session || session.userId !== row.user_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ collection: row });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getCurrentUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value) || {};
  const user = await findUserById(session.userId);
  const result = await updateCollection(id, session.userId, user, {
    name: typeof body.name === "string" ? body.name : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    public: typeof body.public === "boolean" ? body.public : undefined,
    addSlug: typeof body.addSlug === "string" ? body.addSlug : undefined,
    removeSlug: typeof body.removeSlug === "string" ? body.removeSlug : undefined,
  });
  if ("error" in result) {
    const status = result.error === "Not found." ? 404 : result.code === "upgrade_required" ? 402 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json({ collection: result });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getCurrentUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteCollection(id, session.userId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
