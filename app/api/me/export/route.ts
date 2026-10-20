import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserSession } from "@/lib/user-auth";
import { tooManyPublicWrites } from "@/lib/rate-limit";
import { exportUserData } from "@/lib/user-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = await tooManyPublicWrites(req, "me_export", 10, 60 * 60 * 1000);
  if (limited) return limited;

  const session = await getCurrentUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await exportUserData(session.userId);
  if (!data) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="paper-trail-export.json"',
    },
  });
}
