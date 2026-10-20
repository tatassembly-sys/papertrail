import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { anchoredSlugRegex, matchPublishedLabel } from "../lib/name-slug";
import {
  authorIsOnFile,
  listIsOnFile,
  postIsOnFile,
  topicIsOnFile,
} from "../lib/public-route";

const ROUTES = [
  "app/posts/[slug]",
  "app/topics/[tag]",
  "app/authors/[slug]",
  "app/lists/[id]",
] as const;

test("missing post, topic, author, and list are not on file", () => {
  assert.equal(postIsOnFile(null), false);
  assert.equal(postIsOnFile({ slug: "alpha" }), true);
  assert.equal(topicIsOnFile(null), false);
  assert.equal(topicIsOnFile("  "), false);
  assert.equal(topicIsOnFile("Sleep"), true);
  assert.equal(authorIsOnFile(null), false);
  assert.equal(authorIsOnFile(""), false);
  assert.equal(authorIsOnFile("Jane Smith"), true);
  assert.equal(listIsOnFile(null), false);
  assert.equal(listIsOnFile({ public: false }), false);
  assert.equal(listIsOnFile({ public: true }), true);
});

test("an unknown topic slug is not invented from hyphens", () => {
  const labels = ["Sleep", "Machine Learning", "cs.AI"];
  assert.equal(matchPublishedLabel("does-not-exist", labels), null);
  assert.equal(matchPublishedLabel("", labels), null);
  assert.equal(matchPublishedLabel("%E0%A4%A", labels), null);
  assert.equal(matchPublishedLabel("machine-learning", labels), "Machine Learning");
  assert.equal(matchPublishedLabel("cs-ai", labels), "cs.AI");
  assert.equal(matchPublishedLabel("sleeping", ["Sleep"]), null);
  assert.equal(topicIsOnFile(matchPublishedLabel("no-such-topic", labels)), false);
});

test("topic regex matches the whole label only", () => {
  const sleep = anchoredSlugRegex("sleep");
  assert.ok(sleep);
  assert.equal(sleep.test("sleep"), true);
  assert.equal(sleep.test("sleeping"), false);
  assert.equal(sleep.test("deep sleep"), false);
  const ml = anchoredSlugRegex("machine-learning");
  assert.ok(ml);
  assert.equal(ml.test("Machine Learning"), true);
  assert.equal(ml.test("machine learning models"), false);
  assert.equal(anchoredSlugRegex(""), null);
  assert.equal(anchoredSlugRegex("---"), null);
});

test("public record routes call notFound before any loading boundary", () => {
  assert.equal(existsSync("app/loading.tsx"), false);
  assert.equal(existsSync("app/posts/[slug]/loading.tsx"), false);
  for (const route of ROUTES) {
    assert.equal(existsSync(`${route}/loading.tsx`), false, route);
    const src = readFileSync(`${route}/page.tsx`, "utf8");
    const notFoundAt = src.indexOf("notFound()");
    assert.ok(notFoundAt > 0, route);
    const markupAt = src.indexOf("return (");
    // Posts may return an outage card before notFound(); the filed entry comes after it.
    const filedAt = route.endsWith("posts/[slug]") ? src.indexOf("<article") : markupAt;
    assert.ok(filedAt > notFoundAt, route);
  }
  const topic = readFileSync("app/topics/[tag]/page.tsx", "utf8");
  assert.equal(topic.includes("replace(/-/g"), false);
  assert.match(topic, /resolvePublishedTag/);
  assert.match(topic, /topicIsOnFile/);
  assert.match(readFileSync("app/authors/[slug]/page.tsx", "utf8"), /authorIsOnFile/);
  assert.match(readFileSync("app/lists/[id]/page.tsx", "utf8"), /listIsOnFile/);
  assert.match(readFileSync("app/posts/[slug]/page.tsx", "utf8"), /postIsOnFile/);
});
