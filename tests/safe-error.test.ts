import { test } from "node:test";
import assert from "node:assert/strict";
import { publicErrorMessage } from "../lib/safe-error";

const SECRET_TEXT =
  "MongoServerError: bad auth mongodb+srv://user:p@cluster.mongodb.net/papertrail at Object.<anonymous> (/app/lib/mongodb.ts:12:3)";

test("production responses use the fallback and drop driver text", () => {
  const env = process.env as { NODE_ENV?: string };
  const previous = env.NODE_ENV;
  env.NODE_ENV = "production";
  try {
    assert.equal(publicErrorMessage(new Error(SECRET_TEXT), "Something went wrong."), "Something went wrong.");
    assert.equal(publicErrorMessage(SECRET_TEXT, "Something went wrong."), "Something went wrong.");
  } finally {
    env.NODE_ENV = previous;
  }
});

test("non-production returns an Error message and nothing else", () => {
  const env = process.env as { NODE_ENV?: string };
  const previous = env.NODE_ENV;
  env.NODE_ENV = "test";
  try {
    assert.equal(publicErrorMessage(new Error("short detail"), "fallback"), "short detail");
    assert.equal(publicErrorMessage("not-an-error", "fallback"), "fallback");
    assert.equal(publicErrorMessage(undefined, "fallback"), "fallback");
  } finally {
    env.NODE_ENV = previous;
  }
});
