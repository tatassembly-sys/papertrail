/**
 * Print commits since the latest tag. No tag means the whole current history.
 *   npm run release:notes
 */

import { execSync } from "node:child_process";

function git(args) {
  return execSync(`git ${args}`, { encoding: "utf8" }).trim();
}

let tag = "";
try {
  tag = git("describe --tags --abbrev=0");
} catch {
  tag = "";
}

const range = tag ? `${tag}..HEAD` : "HEAD";
const log = git(`log --oneline ${range}`);
console.log(tag ? `Commits since ${tag}` : "No tags yet. Commits reachable from HEAD:");
console.log(log || "(none)");
