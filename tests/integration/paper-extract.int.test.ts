// arXiv extract with scripted DNS and a stubbed fetch. The PDF bytes are not a real PDF,
// so extraction falls back to the abstract without contacting arXiv.
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const originalFetch = globalThis.fetch;

function scriptHost(host: string) {
  const g = globalThis as {
    __ptDnsScript?: Map<string, { address: string; family: number }[]>;
  };
  if (!g.__ptDnsScript) g.__ptDnsScript = new Map();
  g.__ptDnsScript.set(host, [{ address: "1.1.1.1", family: 4 }]);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  (globalThis as { __ptDnsScript?: Map<string, unknown> }).__ptDnsScript?.clear();
});

describe("extractPaperText", () => {
  it("uses the abstract when the PDF cannot be read", async () => {
    const atom = readFileSync("tests/fixtures/arxiv-atom.xml", "utf8");
    scriptHost("arxiv.org");
    scriptHost("export.arxiv.org");
    const calls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("export.arxiv.org")) return new Response(atom, { status: 200 });
      return new Response("not-a-pdf", { status: 200 });
    };
    const { extractPaperText } = await import("../../lib/paper-extract");
    const paper = await extractPaperText("2401.12345");
    assert.match(paper.title, /Night signals/);
    assert.match(paper.text, /short abstract/);
    assert.equal(paper.textKind, "abstract");
    assert.deepEqual(paper.authors, ["Ann Lee"]);
    assert.deepEqual(paper.institutions, ["Example Lab"]);
    assert.match(paper.sourceUrl, /2401\.12345/);
    assert.ok(calls.some((url) => url.includes("export.arxiv.org")));
  });

  it("throws when the arXiv API is down or the locator has no id", async () => {
    scriptHost("export.arxiv.org");
    globalThis.fetch = async () => new Response("down", { status: 500 });
    const { extractPaperText } = await import("../../lib/paper-extract");
    await assert.rejects(() => extractPaperText("2401.12345"), /arXiv API request failed: 500/);
    globalThis.fetch = async () => {
      throw new Error("The operation was aborted");
    };
    await assert.rejects(() => extractPaperText("https://example.test/abs/2401.12345"), /aborted/);
    globalThis.fetch = async () => new Response("not-xml", { status: 200 });
    const empty = await extractPaperText("2401.12345");
    assert.equal(empty.title, "");
    assert.equal(empty.textKind, "abstract");
    await assert.rejects(() => extractPaperText("not-a-paper"), /arXiv ID/);
  });
});
