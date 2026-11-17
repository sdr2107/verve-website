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

## A horizon's weeks (15 November 2026)

A horizon reads from the day it was set. `horizonSpans(h)` in `derive.ts` is the one list of its weeks: the first runs from the start date to that Sunday, the ones after it from Monday to Sunday, the last from the Monday to the end date. A week short at either end has no number (`Span.week` is null): the count starts on the first Monday, so `weekOf` and a plan's weeks carry the same count.

- **A weekly target** (`pacesOf`): the figure in the table is the week in progress (`Pace.week`, from `weekSoFar`), counted from the horizon's own days. The pace word is read from the full weeks that have ended (`fullWeeksSoFar`); before the first one ends it is "No full week yet". A week from before the horizon is never read. The start column keeps the stored start value, which is the week before the horizon.
- **A short week's figures** (`spanFigures`): the app's week row holds the whole calendar week, so a short week is counted from its own days: the dose, the sessions and the strength sessions from the sessions, the zone minutes from the app's own days (`daily_signals.zone2_min`, `zone3_min`, which add up to its week row).
- **A rolling average** (steps, resting heart rate and the other daily markers) keeps its window and names its days (`Pace.window`): it is a level, not a week's total.
- **The check-in's week** (`checkinInputs().week`): the horizon week that has just ended, with `from`, `to`, `days` and `short`. A hand-written plan's weekly counts are read against a full week only.

The function vendors `derive.ts`: re-sync it after this lands (`tools/sync-horizon-web.sh` in METTracker).

## Horizon as a programme (16 November 2026)

Canvas "Verve, Horizon as a programme", boards 04 to 08. Built on the founder's word for **test accounts only**: the set-up is offered to an account in `programme_testers` and to nobody else, and its cards are drawn only on a horizon that carries `horizons.programme`. For everyone else the page is as it was. The offer, its credit and any price are not in this repository.

| File | What it is |
|---|---|
| `src/data/programme.ts` | The four goals and the markers each ticks; what studies report beside each number, each with its paper and how it was read (`checked`); the fitness doors and how far off each can be; the figures a weight number is read against. |
| `src/my-health/horizon/programme.ts` | The arithmetic: what the page already reads, the pace a weight number implies, three signs for fat or muscle, the calls kept. Pure; `tests/programme.test.mjs`. |
| `src/my-health/views/Programme.tsx` | The set-up (`ProgrammeSetup`), the goal and the person's words above the numbers, the weight card, the call sheet. Mounted by `Horizon.tsx`. |

Four rules it keeps: the person sets every number (a goal ticks markers and fills no field); measured before asked; one fitness method from start to end; reached is worked out by the page.

What `derive.ts` gained, and the horizon function must copy (`tools/sync-horizon-web.sh`, which now also needs `data/programme.ts`):

- **A number that is held** (`Target.mode`): `floor` (at least), `ceiling` (at most), `band` (between `low_value` and the number). A weekly marker set as a floor is read like the dose, by the full weeks that reached it (`isStanding`). Any other held number has no line to the date: it is "Held", "Inside your band", or under or over by the gap (`isHeld`, `paceOf`). A move from the start smaller than two readings of one person differ by is not a change (`noChangeOf`: 5 kg for grip, 5% for a fitness test).
- **Fitness by its door** (`Target.method`, `doorOfMethod`, `fitnessBy`): a fitness target kept to a method is read, paced, moved and judged on the date by that method's readings alone. A newer reading by another method rides on the row as `Pace.other`: shown, never compared. A test at its number is "At your number", not "Reached", while the move is inside 5% of the start.

Stored (METTracker `supabase/migrations/20261116_horizon_programme.sql`): `horizons.programme` (jsonb), `horizon_targets.mode`, `.low_value`, `.method`, the table `horizon_weeks` (one row a week: the person's answer when a week fell short, the call and the three lines kept after it; both sides read and write. Its `away` column is no longer written or read: see the pause, below) and `programme_testers`. The function's `start` does not take the new fields: the page writes them after the horizon is set, under the owner's row-level security.

Two more pieces ride with it. `src/pages/horizon.astro` is the way in (board 03): five questions that end in "Set a three-month horizon". It is linked from nowhere and marked `noindex` while it is tried; its answers stay in the browser (`localStorage["verve-way-in"]`) until the set-up reads them. And the group page mounts `mountMondayList` (board 11): for a coach, one row for each client who shares a programme horizon, read from `horizons`, `horizon_weeks` and the latest Monday check-in under row-level security. It draws nothing when no client has one.

**A panel for test accounts.** `views/TesterPanel.tsx` draws a row of `programme_panels`, a table only an account in `programme_testers` can read. The row's words are not in this repository: the file draws whatever the row holds and puts a horizon's own counts into its sentences (`horizon/facts.ts`: targets that read reached today, calls kept, plan weeks kept). It is mounted on a programme horizon for its owner (key `horizon`) and on `/plans` for a signed-in account (key `plans`). With no row, or for anyone not on the list, it draws nothing.

Not built here: the person adding a waist or a grip reading on the website (they come from the app), a distance marker for the marathon goal, and the Guide's rules for a marathon (a coach writes that plan).

## A pause, and deleting (17 November 2026)

Canvas "Verve, Horizon as a programme", board 13. The founder's rule: a horizon can be paused for one week, for illness, travel or anything else. Nothing in the paused week is asked or judged, the date moves seven days later, and the person is not behind for it. The plan they pay for runs on. Three additions he agreed the next day: the pause can reach back to the week that has just ended, until the following Sunday; a horizon has one pause for every three months it was set for (one, two, four), and at most two side by side; on the marathon goal the date stays and the plan closes up by a week.

| File | What it is |
|---|---|
| `src/my-health/horizon/pause.ts` | THE ONE RULE: how many pauses a horizon has, which weeks can be set aside today, and what a pause writes. Pure; `tests/pause.test.mjs`. The page asks it what to offer; the horizon function asks it before it writes. |
| `src/my-health/horizon/derive.ts` | How a paused week is read. `HorizonLike.pauses` is the Mondays set aside; `horizonSpans` lists such a week with `paused` set and `full` not, and no number. Every reader that judges a week already asks `full`, so none of them needed to learn about a pause. |

What follows from the one list, with nothing else changed: the week count stays what it was (the weeks after a pause keep their numbers); a weekly target is read from the weeks that are judged; the calls are counted over the weeks that are judged; the Guide's plan (`horizonMondays`) does not hold the paused week, so the week after it asks what the paused one would have asked.

What was added by hand:

- **The line to the date stands still** (`activeDays`, `elapsedShare`): a paused week's days are in neither count, so a number to reach is exactly as far along on the Monday after a pause as it was on the Monday the pause began.
- **The page says "Paused this week"** in each pace word's place while today is in a paused week (`Pace.paused`, `PAUSED_WORD`). The word itself is kept: the Monday check-in written that morning reads the week before, as usual.
- **The Monday after**, the check-in is two fixed lines written by no model (`pausedCheckinLines`: "The week", "The date"), and the Guide is shown no figure of the paused week (`guideView`).
- **The Guide's plan in a paused week** is shown as it will stand on the Monday it picks up again (`guidePlan`, `GuidePlanView.paused`): the week before the pause is finished and judged, nothing is asked, and "so far" is empty.
- **"A week away" is gone.** Travel or illness used to mark a week away, with no limit and the date unmoved. `WAYS` is now a note for the call and nothing more; `AWAY_WAYS` and `isAwayWay` are removed. The pause is the only way a week is set aside.

Stored (METTracker `supabase/migrations/20261117_horizon_pause.sql`): `horizons.pauses` (the Mondays) and `horizons.ends_on_set` (the date as first set, once a pause has moved it). The page never writes either: the database refuses both to a signed-in person, and the function's `pause` action is their only writer, after `pause.ts` has agreed. So "once" is kept by the server. Both columns are read with the row; before that file is run they are absent, which reads as never paused.

**Offered to test accounts only**, like the rest of the programme: the page shows "Pause for a week" to an owner in `programme_testers`, and the function checks the same list. What the pause must say about payment is with the lawyers.

**"Stop this horizon" became "Delete this horizon"**, for every account. Stopping only set `closed_at`: the horizon left the page and every row stayed where nobody saw it again. Deleting removes the horizon's row, and with it its targets, plan, check-ins, questions, week notes and three health answers (each of those tables is tied to the horizon and goes with it). The person's readings are not the horizon's and are not touched. A horizon read to its date can be deleted the same way. The one free week of a Free account is kept apart from the horizon it began on (the function's `horizon_first`), so deleting a horizon does not hand the week back.

Not changed: the date and the starting numbers of a horizon can still be written by its owner under row-level security. Before anything is earned on a horizon's outcome they need the same lock the pause has.

## A day, a midweek note, a typed fitness test, a diet chart (17 November 2026)

Canvas "Verve, Horizon as a programme", boards 14 to 17. Built for test accounts (`programme_testers`), like the rest of
the programme. Tables and the one new column: METTracker `supabase/migrations/20261118_horizon_days_midweek_chart.sql`.

- **A day to be ready for** (`../../data/programme.ts` DAYS, `programme.ts` dayCount / dayKindOf). The set-up's first
  question. A day sets the horizon's date and says which goals are offered first; it may add markers to the goal's own
  (`goalDraft(goal, canFollow, adds)`). It fills no field. The horizon's `title` is the KIND of day ("A wedding"), which
  a coach and the Guide may read. A name the person gives the day is kept in `horizon_days`, which only its owner
  reads, and never on the horizon's row. A day cannot move, so `pause.ts pauseMovesDate` is false for it: a paused week
  is set aside and the plan closes up. Under `DAY_FEWEST_FULL_WEEKS` full weeks the draft offers only `WEEK_COUNTED`.
- **The midweek note** (`midweek.ts midweekOf`). Thursday's four lines, read to Wednesday night, counted from the days
  (`derive.ts countedFigures`, never the app's week row, which may hold Thursday). No model. Null before Thursday and
  in a week that is not judged. What the week asks is `askedOf`: the plan's lines when there are any, else the weekly
  numbers the person set. Drawn on the horizon's page (`views/Beside.tsx MidweekCard`) and first in The Guide
  (`views/Reads.ts midweekBlock`), from the same function. The switch is `horizons.checkin_midweek` (absent reads as on).
- **A fitness test, typed or read** (`fitnessEntry.ts`, `views/FitnessEntry.tsx`). The set-up asks how fitness will be
  measured: `FITNESS_TESTS`, the surest first. A result is typed into one card, or read from a report by the page
  (`state.ts actions.readFile`, the `report-parser` function's `exercise_test`). THE EQUATIONS ARE THE APP'S:
  `src/vendor/app/crfEquations.ts` is copied word for word by `tools/sync-app-equations.mjs`, with the app's table of
  worked examples, and both repositories test against that table. Nothing in `src/vendor/app` is edited by hand. The
  reading is one row in the app's own table (`crf_entries`), so Overview, the horizon and the phone read one list. A
  watch's estimate can be typed; it is kept as the device's estimate. The one-mile walk has no door of its own (it
  borrows no other test's error) and is its own family: the set-up lists it beside the six-minute walk.
- **A diet chart** (`chart.ts`, `views/Beside.tsx ChartCard`). Kept in `horizon_charts` as it was read (its own words,
  its own script), with one answer a day in `horizon_chart_days`. Both are the owner's alone. The count is said in
  one sentence (`chartCountWords`) and joined to nothing. `chart.ts` is copied into the horizon function, which adds
  the same sentence to Monday's check-in under the head `CHECKIN_HEADS.chart`, after the model has written, so the
  model never sees it. Nothing is worked out from a chart, and the Guide's chat still stops at food.
- **The page's first paint** (`views/Horizon.tsx load`, `api.ts rememberedAccess`). The test list and the Guide's plan
  are asked beside the horizons and set with them, so the page is drawn once. The function's answer about access is
  kept for the tab and asked again behind it. The set-up's writes after `start` are sent together.
- **Sharing a chart** (`chart.ts` CHART_SCOPE / chartSharedWith, `../derive/scopes.ts` TEST_SCOPES / offeredScopes;
  17 November 2026). The chart has its own tick where access is given, "Diet chart": the share's scope `chart`. It is
  offered to test accounts only, is in no preset, and starts unticked. The database lets a person with that tick AND
  the horizon's own tick (`activity`) read `horizon_charts` and `horizon_chart_days`, and write neither (METTracker
  `20261119_horizon_chart_share.sql`). So the page never decides who sees a chart: a viewer's page asks for the rows
  and draws `ChartCard readOnly` when the database hands them over, with the count said as "by their own count", and
  the same count for last week on the call sheet. The file the chart was read from is not shared by this tick, and
  the day's name is never shared. Monday's check-in goes to a coach with the chart's line only on a share that
  carries the tick (the function's `lines.ts checkinFor`).
