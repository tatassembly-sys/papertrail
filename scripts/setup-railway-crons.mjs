import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ENV_ID = "e42a568b-85ed-45db-be63-9310e1626dca";
const APP_URL = "https://papertrail-production-71d6.up.railway.app";

const RAILWAY_JS_LOCAL =
  "C:/Program Files/nodejs/node_modules/@railway/cli/bin/railway.js";

function railway(args) {
  return execFileSync(process.execPath, [RAILWAY_JS_LOCAL, ...args], {
    encoding: "utf8",
  });
}

const kv = railway(["variables", "--service", "papertrail", "--kv"]);
const secretLine = kv.split(/\r?\n/).find((l) => l.startsWith("CRON_SECRET="));
if (!secretLine) throw new Error("CRON_SECRET not found on papertrail service");
const CRON_SECRET = secretLine.slice("CRON_SECRET=".length).trim();
console.log("CRON_SECRET length:", CRON_SECRET.length);

/**
 * curlimages/curl ENTRYPOINT is `curl`. startCommand must be curl argv only.
 * Embed secret + URL literally so no shell env expansion is required
 * (Railway often does not expand $VAR for Docker entrypoint args).
 */
const jobs = [
  {
    name: "cron-arxiv",
    id: "0453d14b-2e36-4247-a81a-cc815149e3e8",
    path: "/api/cron-fetch",
    schedule: "0 6 * * *",
  },
  {
    name: "cron-pubmed",
    id: "1fd60732-f678-43f0-acfc-79d36edb0e1a",
    path: "/api/cron-fetch-pubmed",
    schedule: "30 6 * * *",
  },
  {
    name: "cron-process-queue",
    id: "774e061a-8aac-4031-9be3-6c93c26c74e4",
    path: "/api/process-queue",
    schedule: "*/10 * * * *",
  },
  {
    name: "cron-scheduled",
    id: "b021c7ce-1255-4a51-8438-b03a55546eee",
    path: "/api/process-scheduled-posts",
    schedule: "*/5 * * * *",
  },
];

const mutation = `
mutation ServiceInstanceUpdate($serviceId: String!, $environmentId: String, $input: ServiceInstanceUpdateInput!) {
  serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
}
`;

for (const job of jobs) {
  console.log(`\n=== ${job.name} ===`);

  // Keep env vars for visibility in dashboard, but command is self-contained.
  railway([
    "variable",
    "set",
    `APP_URL=${APP_URL}`,
    "--service",
    job.name,
    "--skip-deploys",
  ]);
  railway([
    "variable",
    "set",
    `CRON_SECRET=${CRON_SECRET}`,
    "--service",
    job.name,
    "--skip-deploys",
  ]);

  // Minimal quoting — curl argv style
  const startCommand = `-fsS -H Authorization: Bearer ${CRON_SECRET} ${APP_URL}${job.path}`;

  const variables = {
    serviceId: job.id,
    environmentId: ENV_ID,
    input: {
      startCommand,
      cronSchedule: job.schedule,
      restartPolicyType: "NEVER",
    },
  };

  const mutFile = join(tmpdir(), `rw-mut-${job.name}.graphql`);
  const varFile = join(tmpdir(), `rw-var-${job.name}.json`);
  writeFileSync(mutFile, mutation);
  writeFileSync(varFile, JSON.stringify(variables));

  try {
    const out = railway(["api", "--file", mutFile, "--variables", `@${varFile}`]);
    console.log("update:", out.trim());
    console.log(
      "startCommand (redacted):",
      startCommand.replace(CRON_SECRET, "***")
    );
  } finally {
    try {
      unlinkSync(mutFile);
      unlinkSync(varFile);
    } catch {
      /* ignore */
    }
  }
}

// Restart latest deployment so new start command is used on next cron fire
console.log("\nRestarting cron services...");
for (const job of jobs) {
  try {
    const out = railway(["restart", "--service", job.name, "--yes"]);
    console.log(job.name, (out || "ok").trim());
  } catch (e) {
    console.log(job.name, "restart skipped:", e.message.split("\n")[0]);
  }
}

console.log("\nDone. Next cron fire will use the fixed start command.");
