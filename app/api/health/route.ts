import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { publicErrorMessage } from "@/lib/safe-error";
import { isEmailConfigured } from "@/lib/mail";
import { isBillingConfigured } from "@/lib/entitlements";
import { runningCommitSha, runningDeploymentEnv } from "@/lib/running-commit";
import { log } from "@/lib/log";
import { cronHealthSummary } from "@/lib/cron-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY?.trim());
    const hasXaiKey = Boolean(process.env.XAI_API_KEY?.trim());
    const freeModel =
      process.env.OPENROUTER_MODEL?.trim() || "openrouter/free";
    // Cron/queue info is informational: a failure here must not fail health.
    const cron = await cronHealthSummary().catch((err) => {
      log.warn("health cron summary failed", err, { route: "/api/health" });
      return { cron_last_run: null, queue_depth: null };
    });
    return NextResponse.json({
      status: "ok",
      db: "connected",
      // Non-sensitive readiness flags (never return key material)
      openrouter: hasOpenRouterKey,
      openrouter_mode: "free",
      openrouter_model: freeModel.endsWith(":free") || freeModel === "openrouter/free"
        ? freeModel
        : "openrouter/free",
      xai: hasXaiKey,
      translator: hasOpenRouterKey ? "openrouter" : hasXaiKey ? "xai" : "extract",
      email: isEmailConfigured() ? "resend" : "log",
      billing: isBillingConfigured() ? "stripe" : "off",
      commit: runningCommitSha(),
      env: runningDeploymentEnv(),
      cron_last_run: cron.cron_last_run,
      queue_depth: cron.queue_depth,
    });
  } catch (err) {
    // Never expose raw driver/TLS messages publicly in production.
    log.error("health check failed", err, { route: "/api/health" });
    return NextResponse.json(
      {
        status: "error",
        db: "unreachable",
        error: publicErrorMessage(err, "Database unavailable"),
        commit: runningCommitSha(),
        env: runningDeploymentEnv(),
      },
      { status: 503 }
    );
  }
}
