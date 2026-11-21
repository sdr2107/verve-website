// The website's own question about the Verve letter, and the page a press lands on. Read from the source.
// One tap for everyone, and no day promised (the founder, 21 November 2026). `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/my-health.astro", import.meta.url), "utf8");
const confirm = readFileSync(new URL("../src/pages/confirm.astro", import.meta.url), "utf8");
const ask = page.slice(page.indexOf('<div id="newsask"'), page.indexOf("</div>", page.indexOf('<div id="newsask"')));
const code = page.slice(page.indexOf("function askForNewsletter"), page.indexOf('$("newsno").addEventListener'));

test("the question is one sentence and two buttons: nothing is typed", () => {
  assert.match(ask, /The Verve letter: one email a week on the science, and what changed in the app\. Send it to you\?/);
  assert.match(ask, /id="newsyes"[^>]*>Yes, send it</);
  assert.match(ask, /id="newsno"[^>]*>No thanks</);
  assert.doesNotMatch(ask, /<input/, "no address field");
  assert.doesNotMatch(page, /newsrelay|newsemail/, "the second question for an address Apple hides is gone");
});

test("an account whose address Apple hides says yes with the address it has", () => {
  assert.match(code, /const to = userEmail\.trim\(\)\.toLowerCase\(\), where = addressWords\(to\);/);
  assert.doesNotMatch(code, /relay address too|One Apple does not hide/, "no address is refused for being one Apple made");
  assert.match(code, /insert\(\{ email: to, consent_text: consent\.slice\(0, 600\), source: "my-health", user_id: userId \}\)/);
});

test("an address Apple made is never printed: the page says whose it is", () => {
  assert.match(page, /const addressWords = \(to: string\) => \(isRelay\(to\) \? "the address Apple keeps for you" : to\);/);
  assert.match(code, /on its way to \$\{where\}, from hello@verve-app\.health/);
  assert.doesNotMatch(code, /on its way to \$\{to\}|first letter to \$\{to\}|could not take \$\{to\}/);
});

test("the stored consent is the sentence that was on screen and the answer", () => {
  assert.match(code, /const consent = `\$\{\$\("newstext"\)\.textContent\?\.trim\(\) \?\? ""\} — Yes, send it\.`;/);
});

test("the page a press lands on promises one letter a week and names no day", () => {
  assert.match(confirm, /It comes to \$\{email\} once a week: one number, its threshold, the study behind it, and what to check\./);
  assert.doesNotMatch(confirm, /on (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/);
});
