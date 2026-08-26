import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { cancelScheduledPost } from "@/lib/scheduledPosts";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const canceled = await cancelScheduledPost(id);

  if (!canceled) {
    return NextResponse.json(
      { error: "Not found, or it already ran/was canceled." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
