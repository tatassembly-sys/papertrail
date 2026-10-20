import { test } from "node:test";
import assert from "node:assert/strict";
import { safeRelativePath } from "../lib/safe-redirect";
import { sanitizeHttpUrl } from "../lib/http-url";
import { isBlockedHostname, nextPublicHop } from "../lib/url-safety";

test("safeRelativePath blocks open redirects", () => {
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/a?x=//b", "", null]) {
    assert.equal(safeRelativePath(bad as string | null, "/home"), "/home", String(bad));
  }
  assert.equal(safeRelativePath("/library", "/home"), "/library");
});

test("sanitizeHttpUrl only allows plain http(s)", () => {
  assert.equal(sanitizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeHttpUrl("data:text/html,hi"), null);
  assert.equal(sanitizeHttpUrl("https://user:pw@example.com"), null);
  assert.equal(sanitizeHttpUrl("https://arxiv.org/abs/1234"), "https://arxiv.org/abs/1234");
  assert.equal(sanitizeHttpUrl("https://x.com/" + "a".repeat(600)), null);
});

test("sanitizeHttpUrl blocks private, loopback, and link-local hosts", () => {
  for (const bad of [
    "http://127.0.0.1/admin",
    "http://localhost/secret",
    "http://10.1.2.3/x",
    "http://192.168.0.5/",
    "http://172.16.0.4/",
    "http://169.254.169.254/latest",
    "http://[::1]/",
    "http://0.0.0.0/",
    "http://metadata.google.internal/",
  ]) {
    assert.equal(sanitizeHttpUrl(bad), null, bad);
    assert.equal(isBlockedHostname(new URL(bad).hostname), true, bad);
  }
  assert.equal(isBlockedHostname("1.1.1.1"), false);
  assert.equal(sanitizeHttpUrl("https://1.1.1.1/dns-query")?.startsWith("https://1.1.1.1/"), true);
});

test("redirect hops to private hosts are blocked", () => {
  assert.equal(nextPublicHop("https://arxiv.org/pdf/1", "http://127.0.0.1/latest"), null);
  assert.equal(nextPublicHop("https://arxiv.org/pdf/1", "http://169.254.169.254/"), null);
  assert.equal(nextPublicHop("https://arxiv.org/pdf/1", "file:///etc/passwd"), null);
  const next = nextPublicHop("https://arxiv.org/pdf/2401.00001", "/pdf/2401.00001v1");
  assert.equal(next, "https://arxiv.org/pdf/2401.00001v1");
});
