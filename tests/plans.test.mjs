// The Plan sheet's price area (board 07): nothing to pay with until a price exists; then each till with its own price. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANS, planOf, isPriced, tillsOf, priceText, PRO_ON_THE_WEB } from "../src/data/plans.ts";

test("while Pro's price is not set, the sheet has no price to print and no till to press", () => {
  const pro = planOf("pro");
  assert.equal(isPriced(pro), false, "the web price is the founder's to set; until then nothing can be bought");
  assert.equal(priceText(pro, "monthly", "usd"), "price to be set");
  assert.deepEqual(tillsOf(pro, "yearly").map((t) => t.price), [null, null]);
});

test("the day a price is filled in, each till carries its own currency and the yearly price is the months less the free ones", () => {
  const pro = { ...planOf("pro"), monthly: { inr: 299, usd: 4 } };
  assert.equal(isPriced(pro), true);
  const monthly = tillsOf(pro, "monthly"), yearly = tillsOf(pro, "yearly");
  assert.deepEqual(monthly.map((t) => [t.key, t.currency, t.price]), [["card", "usd", "$4"], ["upi", "inr", "₹299"]]);
  assert.deepEqual(yearly.map((t) => t.price), ["$40", "₹2,990"]);
  // one currency set, the other not: one till works, the other waits
  const half = { ...planOf("pro"), monthly: { inr: null, usd: 4 } };
  assert.equal(isPriced(half), true); assert.deepEqual(tillsOf(half, "monthly").map((t) => t.price), ["$4", null]);
});

test("the sheet lists what the website holds behind Pro, and no price lives in its words", () => {
  assert.equal(PRO_ON_THE_WEB.length, 3);
  const words = PRO_ON_THE_WEB.map((r) => `${r.lead} ${r.rest}`).join(" ");
  assert.ok(/Horizon/.test(words) && /Guide/.test(words) && /month/.test(words));
  assert.equal(/[$₹]\s?\d/.test(words), false);
  assert.equal(PLANS.filter((p) => p.key === "pro").length, 1);
});
