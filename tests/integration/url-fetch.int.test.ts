// SSRF guard. DNS is scripted by tests/integration/preload.mjs; fetch is stubbed.
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

type Addr = { address: string; family: number };
type Script = Addr[] | "fail" | "empty";

function scripted(): Map<string, Script> {
  const g = globalThis as { __ptDnsScript?: Map<string, Script> };
  if (!g.__ptDnsScript) g.__ptDnsScript = new Map();
  return g.__ptDnsScript;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  scripted().clear();
  globalThis.fetch = originalFetch;
});

function addresses(...ips: string[]): Addr[] {
  return ips.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
}

describe("hostnameResolvesPublic", () => {
  it("blocks literals, private answers, empty answers and DNS failures", async () => {
    const { hostnameResolvesPublic } = await import("../../lib/url-fetch");
    assert.equal(await hostnameResolvesPublic("127.0.0.1"), false);
    assert.equal(await hostnameResolvesPublic("10.1.2.3"), false);
    assert.equal(await hostnameResolvesPublic("169.254.169.254"), false);
    assert.equal(await hostnameResolvesPublic("192.168.1.1"), false);
    assert.equal(await hostnameResolvesPublic("[::1]"), false);
    assert.equal(await hostnameResolvesPublic("fe80::1"), false);
    assert.equal(await hostnameResolvesPublic("1.1.1.1"), true);

    scripted().set("public.example", addresses("1.1.1.1"));
    assert.equal(await hostnameResolvesPublic("public.example"), true);

    scripted().set("mixed.example", addresses("1.1.1.1", "10.0.0.8"));
    assert.equal(await hostnameResolvesPublic("mixed.example"), false);

    scripted().set("private.example", addresses("10.0.0.8"));
    assert.equal(await hostnameResolvesPublic("private.example"), false);

    scripted().set("empty.example", "empty");
    assert.equal(await hostnameResolvesPublic("empty.example"), false);

    scripted().set("fail.example", "fail");
    assert.equal(await hostnameResolvesPublic("fail.example"), false);

    assert.equal(await hostnameResolvesPublic("localhost"), false);
  });
});

describe("fetchPublicHttp", () => {
  it("refuses non-http schemes and private targets without calling fetch", async () => {
    const { fetchPublicHttp } = await import("../../lib/url-fetch");
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response("no");
    };
    for (const url of ["file:///etc/passwd", "javascript:alert(1)", "http://127.0.0.1/secret", "http://[::1]/"]) {
      await assert.rejects(() => fetchPublicHttp(url), /Blocked URL/);
    }
    assert.equal(calls, 0);
  });

  it("allows a public host and refuses a redirect onto a private address", async () => {
    const { fetchPublicHttp } = await import("../../lib/url-fetch");
    scripted().set("papers.example", addresses("1.1.1.1"));
    const seen: string[] = [];
    globalThis.fetch = async (input, init) => {
      seen.push(String(input));
      assert.equal(init?.redirect, "manual");
      assert.equal(init?.method, "POST");
      return new Response("ok", { status: 200 });
    };
    const res = await fetchPublicHttp("https://papers.example/a", { method: "POST", body: "x" });
    assert.equal(res.status, 200);
    assert.equal(seen.length, 1);

    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/latest" } });
    await assert.rejects(() => fetchPublicHttp("https://papers.example/a"), /Blocked redirect/);
  });

  it("stops after four redirects", async () => {
    const { fetchPublicHttp } = await import("../../lib/url-fetch");
    scripted().set("hop.example", addresses("8.8.8.8"));
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(null, { status: 302, headers: { location: "https://hop.example/next" } });
    };
    await assert.rejects(() => fetchPublicHttp("https://hop.example/start"), /Too many redirects/);
    assert.equal(calls, 4);
  });

  it("does not fetch when DNS fails or answers with a private address", async () => {
    const { fetchPublicHttp } = await import("../../lib/url-fetch");
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response("no");
    };
    scripted().set("fail.example", "fail");
    await assert.rejects(() => fetchPublicHttp("https://fail.example/a"), /Blocked URL/);
    scripted().set("private.example", addresses("192.168.0.5"));
    await assert.rejects(() => fetchPublicHttp("https://private.example/a"), /Blocked URL/);
    assert.equal(calls, 0);
  });
});
