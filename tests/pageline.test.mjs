// The line under the greeting (board 08): a sentence, never a stamp. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scopesInWords, ownerLine, viewerLine, careLine, roleChip } from "../src/my-health/derive/pageline.ts";

test("scopes read as a sentence; labs and imaging together are the reports", () => {
  assert.equal(scopesInWords(["labs", "imaging", "activity", "body"]), "activity, body and reports");
  assert.equal(scopesInWords(["activity"]), "activity");
  assert.equal(scopesInWords(["labs", "heart"]), "sleep and heart and labs");
  assert.equal(scopesInWords([]), "nothing yet");
});

test("the owner's line names the other side, counts several, and says nothing when the page is only theirs", () => {
  const pros = [{ email: "rohan@example.com", role: "coach", title: "Rohan Mehta" }];
  assert.deepEqual(ownerLine([{ viewer_email: "Rohan@Example.com", status: "active" }], pros), { lead: "Your page · shared with", who: "Rohan Mehta, coach" });
  assert.deepEqual(ownerLine([{ viewer_email: "meera@example.com", status: "active" }], pros), { lead: "Your page · shared with", who: "meera@example.com" });
  assert.equal(ownerLine([{ viewer_email: "a@x", status: "active" }, { viewer_email: "b@x", status: "active" }, { viewer_email: "c@x", status: "active" }], pros).who, "3 people");
  assert.equal(ownerLine([{ viewer_email: "a@x", status: "invited" }, { viewer_email: "b@x", status: "stopped" }], pros), null, "an invitation not yet accepted is not a share");
  assert.equal(ownerLine([], pros), null);
});

test("no line carries the word client, and a role is only ever coach or clinician", () => {
  const all = [
    JSON.stringify(ownerLine([{ viewer_email: "x@y", status: "active" }], [{ email: "x@y", role: "coach", title: "Verve" }])),
    JSON.stringify(viewerLine("Asha", "2026-11-03T09:00:00Z", ["activity"], new Date("2026-11-10"))),
    JSON.stringify(careLine("Leela", 1948)),
  ].join(" ");
  assert.equal(/client/i.test(all), false);
  assert.equal(roleChip("coach"), "Coach"); assert.equal(roleChip("clinician"), "Clinician"); assert.equal(roleChip("client"), ""); assert.equal(roleChip(null), "");
});

test("a viewer reads whose page it is, since when, and what the share covers", () => {
  const today = new Date("2026-11-10T08:00:00");
  assert.deepEqual(viewerLine("Asha", "2026-11-03T09:00:00", ["labs", "imaging", "activity", "body"], today), { whose: "Asha’s page", rest: "shared with you since 3 November · activity, body and reports" });
  assert.equal(viewerLine("Asha", null, ["activity"], today).rest, "shared with you · activity");
  assert.equal(viewerLine("Asha", "2025-12-30T09:00:00", ["activity"], today).rest, "shared with you since 30 December 2025 · activity");
  assert.deepEqual(careLine("Leela", 1948), { whose: "Leela’s page", rest: "you look after it · born 1948" });
});
