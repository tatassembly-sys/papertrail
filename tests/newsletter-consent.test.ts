import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resendMessageBody, sendEmail } from "../lib/mail";
import { subscriptionConsentUpdate } from "../lib/newsletter";

test("confirm records a timestamp and source", () => {
  const at = new Date("2026-10-19T12:00:00.000Z");
  const update = subscriptionConsentUpdate("double-opt-in", at);
  assert.equal(update.status, "active");
  assert.equal(update.verify_token, null);
  assert.equal(update.consent_at, at);
  assert.equal(update.verified_at, at);
  assert.equal(update.consent_source, "double-opt-in");
  assert.equal(subscriptionConsentUpdate("  ").consent_source, "double-opt-in");
});

test("GET newsletter verify does not confirm", () => {
  const src = readFileSync("app/api/newsletter/verify/route.ts", "utf8");
  const getStart = src.indexOf("export async function GET");
  const postStart = src.indexOf("export async function POST");
  assert.ok(getStart >= 0 && postStart > getStart);
  const getFn = src.slice(getStart, postStart);
  assert.equal(getFn.includes("confirmSubscription"), false);
  assert.match(getFn, /NextResponse\.redirect/);
  assert.match(src, /confirmSubscription\(token, "double-opt-in"\)/);
  assert.match(readFileSync("lib/newsletter.ts", "utf8"), /subscriptionConsentUpdate\(source\)/);
});

test("List-Unsubscribe is a Resend header and log mode still succeeds", async () => {
  const url = "https://example.test/api/newsletter/unsubscribe?token=secret";
  const body = resendMessageBody(
    {
      to: "reader@example.com",
      subject: "Paper Trail",
      html: "<p>Hello</p>",
      listUnsubscribe: url,
    },
    "Paper Trail <news@example.test>"
  );
  assert.equal(body.headers?.["List-Unsubscribe"], `<${url}>`);
  assert.equal(body.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");

  const mail = readFileSync("lib/mail.ts", "utf8");
  const logStart = mail.indexOf('console.log("[mail:log]"');
  const logEnd = mail.indexOf("return { ok: true, mode: \"log\" }");
  const logBlock = mail.slice(logStart, logEnd);
  assert.match(logBlock, /hasListUnsubscribe/);
  assert.equal(logBlock.includes("input.listUnsubscribe }"), false);
  assert.equal(logBlock.includes("listUnsubscribe: input"), false);

  const previous = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    const result = await sendEmail({
      to: "reader@example.com",
      subject: "Paper Trail",
      html: "<p>Hello</p>",
      listUnsubscribe: url,
    });
    assert.equal(result.ok, true);
    assert.equal(result.mode, "log");
  } finally {
    if (previous === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous;
  }
});
