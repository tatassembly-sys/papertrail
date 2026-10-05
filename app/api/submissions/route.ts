import { NextRequest, NextResponse } from "next/server";
import { createSubmission, getSubmissions, hasPendingSubmission, isRateLimited } from "@/lib/submissions";
import { requireAdmin } from "@/lib/auth-server";
import { getClientIp, hashIp } from "@/lib/request-ip";
import { sanitizeHttpUrl } from "@/lib/http-url";
import { JSON_LIMIT_DEFAULT, asRecord, readJsonBody } from "@/lib/json-body";
import { getCurrentUserSession } from "@/lib/user-auth";
import { findUserById } from "@/lib/users";
import {
  DAY_MS,
  FREE_SUBMISSIONS_PER_WEEK,
  PRO_SUBMISSIONS_PER_DAY,
  WEEK_MS,
  isProUser,
} from "@/lib/entitlements";
import { getRateCount, hitRateLimit, undoRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_NOTE_LENGTH = 500;

function freeWeeklyLimitResponse() {
  return NextResponse.json(
    {
      error: "Free accounts can suggest 3 papers a week. Upgrade to Pro for priority requests.",
      code: "upgrade_required",
      upgradeUrl: "/pricing",
    },
    { status: 402 }
  );
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = req.nextUrl.searchParams.get("status");
  const validStatus = status === "pending" || status === "processed" || status === "dismissed" ? status : undefined;
  const submissions = await getSubmissions(validStatus);
  return NextResponse.json({ submissions });
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await readJsonBody(req, JSON_LIMIT_DEFAULT);
    if (!parsed.ok) return parsed.response;
    const body = asRecord(parsed.value);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const rawUrl: string | undefined = typeof body.url === "string" ? body.url.trim() : undefined;
    const note: string | undefined =
      typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE_LENGTH) : undefined;

    // Honeypot: a hidden field real visitors never fill in. If it's set,
    // silently pretend success rather than telling a bot what tripped it.
    if (typeof body.website === "string" && body.website.length > 0) {
      return NextResponse.json({ success: true }, { status: 201 });
    }

    const url = sanitizeHttpUrl(rawUrl);
    if (!url) {
      return NextResponse.json({ error: "Please provide a valid URL." }, { status: 400 });
    }

    if (await hasPendingSubmission(url)) {
      return NextResponse.json({
        success: true,
        note: "That link is already awaiting review — thanks for the suggestion!",
      });
    }

    const ipHash = hashIp(getClientIp(req));
    const session = await getCurrentUserSession();
    const user = session ? await findUserById(session.userId) : null;
    const pro = isProUser(user);

    const weekKey = session ? `user:${session.userId}` : `ip:${ipHash}`;
    let reservedDay = false;
    let reservedWeek = false;
    if (pro) {
      if (await hitRateLimit("submit_day", `user:${session!.userId}`, PRO_SUBMISSIONS_PER_DAY, DAY_MS)) {
        return NextResponse.json(
          { error: "Daily suggestion limit reached. Try again tomorrow." },
          { status: 429 }
        );
      }
      reservedDay = true;
    } else {
      const weekUsed = await getRateCount("submit_week", weekKey, WEEK_MS);
      if (weekUsed >= FREE_SUBMISSIONS_PER_WEEK) return freeWeeklyLimitResponse();
      if (await isRateLimited(ipHash)) {
        return NextResponse.json(
          { error: "You've hit the submission limit for now — please try again later." },
          { status: 429 }
        );
      }
      if (await hitRateLimit("submit_week", weekKey, FREE_SUBMISSIONS_PER_WEEK, WEEK_MS)) {
        return freeWeeklyLimitResponse();
      }
      reservedWeek = true;
    }

    try {
      await createSubmission(url, note, ipHash, {
        priority: pro,
        userId: session?.userId || null,
      });
    } catch (err) {
      if (reservedDay) await undoRateLimit("submit_day", `user:${session!.userId}`, DAY_MS);
      if (reservedWeek) await undoRateLimit("submit_week", weekKey, WEEK_MS);
      throw err;
    }
    return NextResponse.json(
      {
        success: true,
        note: pro
          ? "Thanks — this is marked as a Pro priority request for editors."
          : undefined,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("submission error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
