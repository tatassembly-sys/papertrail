import { NextRequest, NextResponse } from "next/server";
import { getArticleById, markShared } from "@/lib/articles";
import {
  claimDueScheduledPosts,
  markScheduledError,
  markScheduledSent,
} from "@/lib/scheduledPosts";
import { POSTERS, isSocialPlatform } from "@/lib/social";
import { assertCronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 5;

export async function GET(req: NextRequest) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const batch = await claimDueScheduledPosts(BATCH_SIZE);

  if (batch.length === 0) {
    return NextResponse.json({ success: true, processed: 0, message: "Nothing due." });
  }

  const results = [];

  for (const post of batch) {
    try {
      const article = await getArticleById(post.article_id.toString());
      if (!article) {
        await markScheduledError(post._id, post.attempts + 1, "Article no longer exists.");
        results.push({ id: post._id.toString(), status: "error", error: "article missing" });
        continue;
      }

      if (article.status !== "published") {
        await markScheduledError(post._id, 999, "Article is not published.");
        results.push({
          id: post._id.toString(),
          platform: post.platform,
          status: "error",
          error: "not published",
        });
        continue;
      }

      if (!article.share_approved) {
        await markScheduledError(post._id, 999, "Share approval revoked.");
        results.push({
          id: post._id.toString(),
          platform: post.platform,
          status: "error",
          error: "share not approved",
        });
        continue;
      }

      const poster = isSocialPlatform(post.platform) ? POSTERS[post.platform] : undefined;
      if (!poster) {
        // Force terminal error status (markScheduledError uses attempts >= 3).
        await markScheduledError(post._id, 999, `Unknown platform: ${post.platform}`);
        results.push({
          id: post._id.toString(),
          platform: post.platform,
          status: "error",
          error: "unknown platform",
        });
        continue;
      }

      const result = await poster(article);

      if (result.success) {
        await markScheduledSent(post._id);
        await markShared(article.id!, post.platform);
        results.push({ id: post._id.toString(), platform: post.platform, status: "sent" });
      } else {
        await markScheduledError(post._id, post.attempts + 1, result.error || "unknown error");
        results.push({
          id: post._id.toString(),
          platform: post.platform,
          status: "error",
          error: result.error,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      await markScheduledError(post._id, post.attempts + 1, message);
      results.push({ id: post._id.toString(), platform: post.platform, status: "error", error: message });
    }
  }

  return NextResponse.json({ success: true, processed: batch.length, results });
}
