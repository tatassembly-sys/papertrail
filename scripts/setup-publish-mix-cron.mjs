import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ENV_ID = "e42a568b-85ed-45db-be63-9310e1626dca";
const APP_URL = "https://papertrail-production-71d6.up.railway.app";
const SERVICE_ID = "e564305a-fa00-4ccd-a380-cf73fcc4b64a";
const SCHEDULE = "0 8 * * *"; // 08:00 UTC — after arXiv 06:00 and a few queue ticks

const RAILWAY_JS_LOCAL =
  "C:/Program Files/nodejs/node_modules/@railway/cli/bin/railway.js";

function railway(args) {
  return execFileSync(process.execPath, [RAILWAY_JS_LOCAL, ...args], {
    encoding: "utf8",
  });
}

const kv = railway(["variables", "--service", "papertrail", "--kv"]);
const secretLine = kv.split(/\r?\n/).find((l) => l.startsWith("CRON_SECRET="));
if (!secretLine) throw new Error("CRON_SECRET not found");
const CRON_SECRET = secretLine.slice("CRON_SECRET=".length).trim();

const startCommand = `node -e "fetch('${APP_URL}/api/cron-publish-mix',{headers:{Authorization:'Bearer ${CRON_SECRET}'}}).then(async r=>{const t=await r.text();console.log(t);if(!r.ok)process.exit(1)}).catch(e=>{console.error(e);process.exit(1)})"`;

const mutation = `
mutation ServiceInstanceUpdate($serviceId: String!, $environmentId: String, $input: ServiceInstanceUpdateInput!) {
  serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
}
`;

const mutFile = join(tmpdir(), "rw-mix-mut.graphql");
const varFile = join(tmpdir(), "rw-mix-var.json");
writeFileSync(mutFile, mutation);
writeFileSync(
  varFile,
  JSON.stringify({
    serviceId: SERVICE_ID,
    environmentId: ENV_ID,
    input: {
      startCommand,
      cronSchedule: SCHEDULE,
      restartPolicyType: "NEVER",
    },
  })
);

try {
  railway(["variable", "set", `APP_URL=${APP_URL}`, "--service", "cron-publish-mix", "--skip-deploys"]);
  railway(["variable", "set", `CRON_SECRET=${CRON_SECRET}`, "--service", "cron-publish-mix", "--skip-deploys"]);
  const out = railway(["api", "--file", mutFile, "--variables", `@${varFile}`]);
  console.log("update", out.trim());
  console.log("schedule", SCHEDULE);
  console.log("path /api/cron-publish-mix");
} finally {
  try {
    unlinkSync(mutFile);
    unlinkSync(varFile);
  } catch {
    /* ignore */
  }
}
