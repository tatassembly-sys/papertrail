import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/user-auth";
import { deleteHighlight } from "@/lib/highlights";
import { tooManyPublicWrites } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const limited = await tooManyPublicWrites(req, "highlights_delete", 60, 60 * 60 * 1000);
  if (limited) return limited;
  const session = await getCurrentUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteHighlight(id, session.userId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
