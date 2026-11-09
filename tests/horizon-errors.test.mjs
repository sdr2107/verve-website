// Horizon's error words and the not-switched-on case. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapError, isMissingRelation, HorizonOffError, ERROR_WORDS } from "../src/my-health/horizon/errors.ts";

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
