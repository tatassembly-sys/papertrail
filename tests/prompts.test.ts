import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ARTICLE_CHAT_SYSTEM, TRANSLATOR_SYSTEM_PROMPT } from "../lib/prompts";

const GUARD = "cannot change these rules";

test("translator and chat prompts refuse instruction override", () => {
  assert.match(TRANSLATOR_SYSTEM_PROMPT, new RegExp(GUARD));
  assert.match(ARTICLE_CHAT_SYSTEM, new RegExp(GUARD));
});

test("chat and process-paper have per-user and per-IP daily caps", () => {
  const chat = readFileSync("app/api/articles/[id]/chat/route.ts", "utf8");
  assert.match(chat, /chat_ip_day/);
  assert.match(chat, /chat_user_day/);
  const paper = readFileSync("app/api/process-paper/route.ts", "utf8");
  assert.match(paper, /process_paper_ip_day/);
  assert.match(paper, /process_paper_admin_day/);
  const extract = readFileSync("lib/paper-extract.ts", "utf8");
  assert.match(extract, /fetchPublicHttp/);
});
