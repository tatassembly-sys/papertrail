import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ENV_ID = "e42a568b-85ed-45db-be63-9310e1626dca";
const RAILWAY_JS =
  "C:/Program Files/nodejs/node_modules/@railway/cli/bin/railway.js";

function railway(args) {
  return execFileSync(process.execPath, [RAILWAY_JS, ...args], {
    encoding: "utf8",
  });
}

const jobs = {
  "cron-arxiv": "fc1c23be-5a63-444b-ad1d-385cc5c535e1",
  "cron-pubmed": "5f37a9f5-261f-4473-8975-d588f3b2eb0a",
  "cron-process-queue": "ffd97c9b-76cd-4a47-8d48-83e23fae7eb5",
  "cron-scheduled": "bb717cdb-e399-4ec3-9de0-0ecc8bff0ab6",
};

const query = `
query($serviceId: String!, $environmentId: String!) {
  serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
    startCommand
    cronSchedule
    nextCronRunAt
  }
}
`;

const qf = join(tmpdir(), "rw-cron-q.graphql");
writeFileSync(qf, query);

for (const [name, id] of Object.entries(jobs)) {
  const vf = join(tmpdir(), `rw-cron-v-${name}.json`);
  writeFileSync(
    vf,
    JSON.stringify({ serviceId: id, environmentId: ENV_ID })
  );
  try {
    const out = railway(["api", "--file", qf, "--variables", `@${vf}`]);
    const parsed = JSON.parse(out);
    const inst = parsed?.data?.serviceInstance;
    console.log(`\n=== ${name} ===`);
    console.log("schedule:", inst?.cronSchedule);
    console.log("next:", inst?.nextCronRunAt);
    console.log(
      "cmd:",
      (inst?.startCommand || "").replace(/Bearer [^']+/, "Bearer ***")
    );
  } finally {
    try {
      unlinkSync(vf);
    } catch {
      /* */
    }
  }
}
try {
  unlinkSync(qf);
} catch {
  /* */
}
