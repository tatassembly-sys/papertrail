import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const SECRET_FORMS = [
  "app/login/page.tsx",
  "app/user-login/page.tsx",
  "app/register/page.tsx",
  "app/reset-password/page.tsx",
  "components/TokenActionForm.tsx",
];

test("secret forms post so a submit before hydration stays out of the URL", () => {
  for (const file of SECRET_FORMS) {
    const src = readFileSync(file, "utf8");
    const forms = src.match(/<form\b[^>]*>/g) || [];
    assert.ok(forms.length > 0, file);
    for (const form of forms) {
      assert.match(form, /method="post"/, `${file} ${form}`);
    }
  }
  const login = readFileSync("app/login/page.tsx", "utf8");
  assert.match(login, /name="password"/);
  assert.match(login, /type="password"/);
});
