// The programme's set-up, one card at a time (board 18 of "Verve, Horizon as a programme"): the one answer each card
// needs, how far a person may open, and each card's address. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SETUP_CARDS, CARD_COUNT, NUMBERS_CARD, cardNeeds, cardReady, besideOptional, reachOf, cardShown, cardOfRoute, routeOfCard, emailShape } from "../src/my-health/horizon/setupCards.ts";

/** A set-up with nothing asked of it: no day, a goal chosen, the Guide writing with its questions answered, nobody to invite. */
const facts = (o = {}) => ({ hasDay: false, dateAhead: false, goal: true, guideAsks: true, screenAnswered: true, coachNeeded: false, coach: "none", coachTicks: true, coachSeesHorizon: true, chartUnchecked: false, ...o });

test("seven cards, the numbers last", () => {
  assert.deepEqual(SETUP_CARDS.map((c) => c.label), ["The day", "What for", "Who writes", "What the page reads", "Three things", "Beside it", "Your numbers"]);
  assert.equal(CARD_COUNT, 7);
  assert.equal(NUMBERS_CARD, 7);
});

test("Next lights when the card's one needed answer is given", () => {
  // the day: a length of time needs nothing more; a day needs its date, ahead of today
  assert.equal(cardReady("day", facts()), true);
  assert.equal(cardNeeds("day", facts({ hasDay: true })), "Give the day's date. It has to be ahead of today.");
  assert.equal(cardReady("day", facts({ hasDay: true, dateAhead: true })), true);
  assert.equal(cardNeeds("goal", facts({ goal: false })), "Choose what this horizon is for.");
  // who writes always has an answer, and what the page reads asks none
  assert.equal(cardReady("writer", facts({ goal: false })), true);
  assert.equal(cardReady("reads", facts({ goal: false })), true);
});

test("the three health questions cannot be skipped when the Guide writes the plan", () => {
  assert.equal(cardNeeds("three", facts({ screenAnswered: false })), "Answer the three questions about your health.");
  // a coach writes it, or the Guide's plan cannot be kept for this project: the questions are not asked
  assert.equal(cardReady("three", facts({ guideAsks: false, screenAnswered: false })), true);
});

test("the sixth card is optional, until a coach who writes the week has to be invited", () => {
  assert.equal(besideOptional(facts()), true);
  assert.equal(cardReady("beside", facts()), true);
  assert.equal(cardReady("beside", facts({ coach: "ok" })), true);
  assert.equal(cardNeeds("beside", facts({ coach: "bad" })), "That email is not complete.");
  assert.equal(cardNeeds("beside", facts({ coach: "self" })), "That email is yours. Give your coach's.");
  assert.equal(cardNeeds("beside", facts({ coach: "ok", coachTicks: false, coachSeesHorizon: false })), "Tick at least one thing for them to see.");
  // a coach who only looks may be given any ticks; one who writes the week has to see the horizon
  assert.equal(cardReady("beside", facts({ coach: "ok", coachSeesHorizon: false })), true);
  const needed = facts({ coachNeeded: true });
  assert.equal(besideOptional(needed), false);
  assert.equal(cardNeeds("beside", needed), "Give your coach's email, or choose to invite them later.");
  assert.equal(cardReady("beside", { ...needed, coach: "later" }), true);
  assert.equal(cardReady("beside", { ...needed, coach: "ok" }), true);
  assert.match(cardNeeds("beside", { ...needed, coach: "ok", coachSeesHorizon: false }), /Activity and fitness/);
  // a chart that was read waits for its check before the card is left
  assert.equal(cardNeeds("beside", facts({ chartUnchecked: true })), "Check what was read from the chart, or leave that file.");
});

test("no card is reached by its address alone, and a card already seen opens again", () => {
  // nothing seen yet: the first card, whatever the address asks; Next from it opens the second
  assert.equal(reachOf(facts(), 1), 2);
  assert.equal(cardShown(7, facts(), 1), 1);
  assert.equal(cardShown(1, facts(), 1), 1);
  assert.equal(cardShown(2, facts(), 1), 2);
  // four cards seen: the fifth opens by Next, the seventh does not open by its address
  assert.equal(cardShown(5, facts(), 4), 5);
  assert.equal(cardShown(7, facts(), 4), 4);
  // every card seen and every answer given: any card opens
  assert.equal(reachOf(facts(), 7), 7);
  for (let n = 1; n <= 7; n++) assert.equal(cardShown(n, facts(), 7), n);
  // an answer taken back closes the cards past it
  assert.equal(reachOf(facts({ goal: false }), 7), 2);
  assert.equal(cardShown(6, facts({ goal: false }), 7), 2);
  assert.equal(reachOf(facts({ screenAnswered: false }), 7), 5);
  assert.equal(reachOf(facts({ hasDay: true }), 7), 1);
  // an address that is not a card is the first card
  assert.equal(cardShown(Number.NaN, facts(), 7), 1);
  assert.equal(cardShown(0, facts(), 7), 1);
  assert.equal(cardShown(99, facts(), 7), 7);
});

test("each card has an address, so the browser's Back is one card back", () => {
  assert.equal(routeOfCard(1), "new");
  assert.equal(routeOfCard(4), "new-4");
  assert.equal(routeOfCard(7), "new-7");
  assert.equal(routeOfCard(8), "new");
  assert.equal(cardOfRoute("new"), 1);
  assert.equal(cardOfRoute("new-4"), 4);
  assert.equal(cardOfRoute("new-7"), 7);
  // a horizon's own id, the pane's first page and a card that is not there are not the set-up
  for (const r of ["", "new-8", "new-0", "new-12", "newer", "3f6c1d1e-0000-4000-8000-000000000000"]) assert.equal(cardOfRoute(r), 0, r);
  for (let n = 1; n <= 7; n++) assert.equal(cardOfRoute(routeOfCard(n)), n);
});

test("an email is nothing, usable or incomplete", () => {
  assert.equal(emailShape("  "), "none");
  assert.equal(emailShape("coach@example.com"), "ok");
  assert.equal(emailShape(" Coach@Example.co.in "), "ok");
  for (const bad of ["coach", "coach@", "coach@example", "co ach@example.com", "@example.com"]) assert.equal(emailShape(bad), "bad", bad);
});
