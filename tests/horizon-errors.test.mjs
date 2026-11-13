// Horizon's error words and the not-switched-on case. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapError, isMissingRelation, HorizonOffError, ERROR_WORDS } from "../src/my-health/horizon/errors.ts";
import { parseAccess } from "../src/my-health/horizon/access.ts";

test("the function's answers, in the page's words", () => {
  assert.equal(mapError(402, { error: "pro_required" }), "pro_required");
  assert.equal(mapError(412, {}), "consent_required");
  assert.equal(mapError(404, {}), "not_switched_on");
  assert.equal(mapError(503, { error: "horizon_not_open" }), "not_open");
  assert.equal(mapError(409, {}), "horizon_closed");
  assert.equal(ERROR_WORDS.not_switched_on, "Horizon is not switched on for this account yet.");
});

test("a missing table means the backend is not there yet, not an error", () => {
  assert.equal(isMissingRelation({ code: "42P01", message: 'relation "public.horizons" does not exist' }), true);
  assert.equal(isMissingRelation({ code: "PGRST205", message: "Could not find the table 'public.horizons' in the schema cache" }), true);
  assert.equal(isMissingRelation({ code: "42501", message: "permission denied for table horizons" }), false);
  assert.equal(isMissingRelation(null), false);
  assert.equal(new HorizonOffError().name, "HorizonOff");
});

test("the chat's two answers that are not errors of the page: the week's questions used up, and no plan in use", () => {
  assert.equal(mapError(429, { error: "weekly_limit" }), "week_limit");
  assert.equal(mapError(429, { error: "Daily AI usage limit reached. Try again tomorrow." }), "allowance");
  assert.equal(mapError(409, { error: "no_plan" }), "no_plan");
  assert.match(ERROR_WORDS.week_limit, /come back on Monday/);
});

test("what an account may do on Horizon: Pro, the free week running, the free week over, and an older function", () => {
  const now = Date.parse("2026-11-13T10:00:00Z");
  const pro = parseAccess({ plan: "pro", through: "web", horizon_free: { available: false, until: null }, asks: { limit: 20, used: 3 } }, now);
  assert.deepEqual(pro, { pro: true, free: { available: false, until: null, running: false }, asks: { limit: 20, left: 17 } });
  const running = parseAccess({ plan: "free", horizon_free: { available: false, until: "2026-11-16T09:00:00Z" }, asks: { limit: 1, used: 0 } }, now);
  assert.ok(!running.pro && running.free.running && running.asks.left === 1);
  const over = parseAccess({ plan: "free", horizon_free: { available: false, until: "2026-11-10T09:00:00Z" }, asks: { limit: 1, used: 1 } }, now);
  assert.ok(!over.free.running && over.asks.left === 0);
  const fresh = parseAccess({ plan: "free", horizon_free: { available: true, until: null }, asks: { limit: 1, used: 0 } }, now);
  assert.ok(fresh.free.available && !fresh.free.running);
  // a function deployed before the free week answers without it: the page then behaves as it did
  assert.equal(parseAccess({ plan: "pro", through: "vip", until: null, trial: { available: false, ends_at: null } }, now), null);
  assert.equal(parseAccess(null, now), null);
});
