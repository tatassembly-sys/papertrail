import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "../app/api/posts/published/route";
import { PROBE_CACHE_CONTROL } from "../lib/post-probe";

test("posts/published probe sends a short shared Cache-Control on 404", async () => {
  const res = await GET(new NextRequest("http://localhost/api/posts/published?slug="));
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("cache-control"), PROBE_CACHE_CONTROL);
  assert.match(PROBE_CACHE_CONTROL, /s-maxage=60/);
});
