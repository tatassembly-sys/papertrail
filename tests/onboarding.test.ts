import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSlugList, personaliseMix, rememberRead, shouldShowNewsletterCta } from "../lib/onboarding";

test("newsletter CTA appears from the 2nd distinct article, never when dismissed", () => {
  let read: string[] = [];
  read = rememberRead(read, "a");
  assert.equal(shouldShowNewsletterCta(read, false), false);
  read = rememberRead(read, "a");
  assert.equal(shouldShowNewsletterCta(read, false), false);
  read = rememberRead(read, "b");
  assert.equal(shouldShowNewsletterCta(read, false), true);
  assert.equal(shouldShowNewsletterCta(read, true), false);
  assert.equal(rememberRead(Array.from({ length: 60 }, (_, i) => `s${i}`), "x").length, 50);
});

test("parseSlugList tolerates junk", () => {
  assert.deepEqual(parseSlugList(null), []);
  assert.deepEqual(parseSlugList("{"), []);
  assert.deepEqual(parseSlugList('["a",1,"b"]'), ["a", "b"]);
});

test("personaliseMix puts followed topics first and marks them", () => {
  const items = [
    { slug: "1", category: "math", tags: [] },
    { slug: "2", category: "q-bio", tags: ["Neuroscience"] },
    { slug: "3", category: "physics", keywords: ["neuroimaging"] },
  ];
  const out = personaliseMix(items, ["neuro"]);
  assert.deepEqual(out.map((o) => [o.item.slug, o.forYou]), [["2", true], ["3", true], ["1", false]]);
  assert.deepEqual(personaliseMix(items, []).map((o) => o.forYou), [false, false, false]);
});

test("welcome sends readers to the personalised /today and posts carry the nudge", () => {
  assert.match(readFileSync("components/WelcomeTopics.tsx", "utf8"), /router\.push\("\/today"\)/);
  assert.match(readFileSync("app/posts/[slug]/page.tsx", "utf8"), /<NewsletterNudge slug=/);
});
