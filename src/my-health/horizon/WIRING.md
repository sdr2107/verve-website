# Horizon: wiring it into the My health page

Three new files carry the feature; the page needs a pane, a mount, a tab and its sub-links.

| File | What it is |
|---|---|
| `src/my-health/horizon/derive.ts` | The arithmetic: the marker catalogue, the latest reading of each, pace, the implied pace note, adherence, the Guide's draft plan, the road, the check-in's inputs. Pure; `tests/horizon.test.mjs`. |
| `src/my-health/horizon/api.ts` | The rows (`horizons`, `horizon_targets`, `horizon_plans`, `horizon_checkins`) and the edge function `horizon` (start, check-in) with the error mapping. |
| `src/my-health/views/Horizon.tsx` | The Preact view: board 14 (the horizon in view) and board 15 (the set-up), one mount. |

## The Guide's plan (13 November 2026)

| File | What it is |
|---|---|
| `src/data/plan-rules.ts` | Every rule the plan is worked out from, with its source and how well it was checked. |
| `src/my-health/horizon/guidePlan.ts` | The plan's arithmetic and its fixed sentences: the three questions, the climb, where a person is on it, the changes on offer, the chat's inputs. Pure; `tests/guide-plan.test.mjs`. The horizon function copies it. |
| `src/my-health/horizon/access.ts` | What the account may do: Pro, or the one free week. Pure. |
| `src/my-health/views/GuidePlan.tsx` | The offer (three questions, then the draft), the plan in use, the chat. Mounted inside Horizon's plan card. |

The plan is kept in `horizon_plans.guide`, the answers in `horizon_screens` (the person's alone), the chat in `horizon_asks`
(METTracker `supabase/migrations/20261114_horizon_guide_plan.sql`). Until that file is run the page shows the plan card as it
was: `guidePlanReady()` asks once whether the column is there. The chat is the function's `ask` action. No model writes the
plan; the model speaks only in the chat, from the figures `askInputs()` gives it.

## A finished week, a week won back, a number that can be changed (14 November 2026)

Boards 09 and 10 of the canvas "Verve, the Guide's plan". All of it is arithmetic and fixed words in `guidePlan.ts`; nothing
new is stored except two optional fields in `horizon_plans.guide`, so no migration is needed.

| What | Where |
|---|---|
| The week just finished, line by line, with where a zone 2 gap went and what it does to the plan | `guidePlan().review`; the "Last week" tab |
| Every week of the plan, done over asked | `guidePlan().climb[i].done` and `.short`; the table on "The climb" (or "The weeks" when nothing climbs) |
| A week won back | `progressOf()`: behind its first line, a week that also covers the next step is not asked that step twice. Zone 2 only, never past the first line |
| What the plan does for each target | `guidePlan().answers` |
| Changing the zone 2 number, or any target | `Changer` in `GuidePlan.tsx`; "Change" on a row of the targets table; `api.ts updateTarget` |
| A change never rewrites a week behind the person | `freezeOf()` writes `guide.past` (what each finished week asked) and, for a number the plan follows (`PLAN_MARKERS`), `guide.leg` (the week it was changed in keeps its figures and the climb goes on from it) |
| One typical week for the set-up, the table and the plan | `derive.ts typicalWeek()`; `baseOf()` reads it |
| Fitness is one marker | `derive.ts openTargets()` reads a VO₂max target as Fitness; `TARGET_MARKERS` no longer offers VO₂max |

The horizon function copies `derive.ts`, `guidePlan.ts` and `plan-rules.ts`: after a change here, run
`tools/sync-horizon-web.sh <this commit>` in METTracker and deploy `horizon`, or the check-in's lines and the chat's figures
lag the page.

## The pane

In `src/pages/my-health.astro`, beside the other panes, present from the first byte:

```html
<section id="tab-horizon" hidden>
  <div id="horizonroot"></div>
</section>
```

`setTab("horizon")` shows it like the others (the key is `horizon`; hashes `#horizon`, `#horizon-<id>`, `#horizon-new`).

## The mount

Where the other views are mounted (the end of the page script):

```ts
import { mountHorizon } from "../my-health/views/Horizon.tsx";

const horizonView = mountHorizon($("horizonroot"), {
  supabase: supabase as any,
  personId: () => person?.id ?? null,            // the person whose page is open
  userId: () => session?.user?.id ?? null,       // optional; the view falls back to the session
  derived: () => derived.value,                  // the PersonData signal from ../my-health/state.ts
  isOwner: () => !!person && (person.self || person.mine), // the owner writes; a coach reads and writes the plan
  goTab: (t) => setTab(t),
  onHorizons: (list) => drawHorizonSubLinks(list), // the sidebar's sub-links, below
});
```

Call `horizonView.refresh()` after the document is refreshed (the end of `refresh()`), after a person switch, and after `setTab("horizon")`. Call `horizonView.open(location.hash)` from the hash handling when the hash starts with `#horizon` (and once at boot).

## The tab and its sub-links

The Horizon tab sits after In depth, with the `Pro` badge, in the static markup. Its sub-links are the open horizons and "Set another":

```ts
function drawHorizonSubLinks(list: { id: string; title: string; ends_on: string }[]) {
  const el = $("horizonsubs");                   // a <div data-sub="horizon"> under the tab, present from the first byte
  el.innerHTML = [
    ...list.map((h) => `<a class="sub" href="#horizon-${h.id}">${esc(h.title.split(",")[0].split(" ").slice(0, 2).join(" "))} · ${dayMonth(h.ends_on)}</a>`),
    `<a class="sub" href="#horizon-new">${list.length ? "Set another" : "Set a horizon"}</a>`,
  ].join("");
}
```

The sub-links follow the active tab like Overview's and In depth's (`data-active-tab` on the nav); nothing here is added by a loader except the names, and the slot has a fixed height until they arrive. Inside the pane the sections carry `#horizon-targets`, `#horizon-plan` and `#horizon-checkin` for "Boston · 18 April", "The plan" and "Check-ins" if those three sub-links are wanted as on the canvas.

## Pro

No client flag decides it. The function answers `402 pro_required` to `start` and `checkin`; the view then shows the Pro card (the board's words, a link to `/plans`, "Not now" back to Overview) in place of the pane. A person with an open horizon is Pro by that fact and sees it read-only even after a lapse (the rows are theirs under RLS). A coach never meets the gate: they only read, and write the plan.

`412 consent_required` shows the consent box (the same `ai_consent.summary_at` row the Guide's read sets) and retries. `429` says today's allowance is used up. `409 horizon_closed` and `503` ("The Guide is not available right now") are lines, not cards.

## Messages

When `send_to_coach` is on, the function posts a Messages row (`sender_role` system, `sender_label` Verve, `kind` read, payload `{horizon_id, checkin_id, kind, for_date, on, title, lead}`); the existing Messages view renders it from `on/title/lead`. A later step can link that row to `#horizon-<horizon_id>`.

## Theme names

The view uses the redesign's Tailwind theme colours only: `canvas card alt border border-strong text text-2 text-3 text-4 accent accent-text accent-fill accent-border good caution concern z2 z3 z3-text`, Inter for words and `font-mono` for figures, radii 16 / 10 / full. It renders unstyled on `main` until `global.css` defines them.
