// Horizon is not offered to everyone (26 November 2026; src/data/story.ts HORIZON_PUBLIC, off). The founder: it is for
// the founding members of his community for now. One switch; while it is off the public pages say nothing of
// Horizon, My health draws it only for an account that has it, /horizon shows its questions to those accounts
// only, and nobody is offered a button the server would refuse. Read from the source. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HORIZON_PUBLIC, STORY, STORY_ALL, STORY_LINE, STORY_TITLE } from "../src/data/story.ts";
import { HORIZON_KEPT, HORIZON_PUBLIC as SWITCH_WITH_THE_RULE, hasHorizon, isShownHorizon, maySetHorizon } from "../src/my-health/horizon/access.ts";
import { HELP_DOORS } from "../src/data/help.ts";
import { WEEKLY_CARRIES, WEEKLY_CARRIES_PLAIN } from "../src/my-health/account.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../src/pages/my-health.astro");

test("the switch is off, and it is one value: the public pages and the rule the server takes read the same one", () => {
  assert.equal(HORIZON_PUBLIC, false);
  assert.equal(SWITCH_WITH_THE_RULE, HORIZON_PUBLIC);
  assert.match(read("../src/data/story.ts"), /import \{ HORIZON_PUBLIC \} from "\.\.\/my-health\/horizon\/access\.ts";\s*export \{ HORIZON_PUBLIC \};/);
  // the horizon function takes access.ts and founding.ts verbatim (METTracker tools/sync-horizon-web.sh): neither may
  // reach for the browser, and access.ts stands alone
  const access = read("../src/my-health/horizon/access.ts"), founding = read("../src/my-health/horizon/founding.ts");
  assert.doesNotMatch(access, /^import /m);
  assert.doesNotMatch(founding, /^import /m);
  for (const src of [access, founding]) assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), /\bwindow[.[]|\blocalStorage\b|\bsessionStorage\b|\bnavigator[.[]|\bdocument\./);
});

test("who has Horizon: an account the programme is on for, or a person who already has a horizon to show", () => {
  const off = (programme, horizons) => hasHorizon({ open: false, programme, horizons });
  assert.equal(off(true, 0), true, "one of Verve's own, or a founding member: before they have set anything");
  assert.equal(off(false, 1), true, "a horizon set before: nobody loses what they started");
  assert.equal(off(false, 0), false, "everyone else: no tab, no door");
  // the day Horizon is offered to everyone, everyone has it
  assert.equal(hasHorizon({ open: true, programme: false, horizons: 0 }), true);
});

test("a horizon that can be shown is an open one or one read to its date; one stopped the old way opens no door", () => {
  assert.equal(isShownHorizon({ closed_at: null, checkins: [] }), true);
  assert.equal(isShownHorizon({ closed_at: "2026-10-01T00:00:00Z", checkins: [{ kind: "week" }, { kind: "final" }] }), true);
  assert.equal(isShownHorizon({ closed_at: "2026-10-01T00:00:00Z", checkins: [{ kind: "week" }] }), false);
  assert.equal(isShownHorizon({ closed_at: "2026-10-01T00:00:00Z" }), false);
});

test("who may set a new one: the owner, where the server would start it", () => {
  assert.equal(maySetHorizon({ open: false, programme: true, owner: true }), true);
  assert.equal(maySetHorizon({ open: false, programme: false, owner: true }), false, "a person who only keeps an old horizon is shown no 'Set another'");
  assert.equal(maySetHorizon({ open: false, programme: true, owner: false }), false, "a coach never sets a client's");
  assert.equal(maySetHorizon({ open: true, programme: false, owner: true }), true);
});

test("the public story is three questions while Horizon is not offered, and says nothing of it", () => {
  assert.deepEqual(STORY.map((s) => s.key), ["overview", "depth", "guide"]);
  assert.equal(STORY_TITLE, "Your health, in three questions");
  assert.equal(STORY_LINE, "See where you stand, how you got here, and what stands out.");
  const told = [STORY_TITLE, STORY_LINE, ...STORY.flatMap((s) => [s.name, s.question, s.line, s.more, s.plan])].join(" ");
  assert.doesNotMatch(told, /horizon|where (you are|am i) going/i);
  // the fourth part is kept whole for the day the switch goes on
  assert.equal(STORY_ALL.length, 4); assert.equal(STORY_ALL[3].name, "Horizon");
  // the three places that tell the story read it from the data, and count the parts from it
  const landing = read("../src/pages/index.astro"), manual = read("../src/pages/how-it-works.astro");
  assert.ok(landing.includes("{STORY_TITLE}") && landing.includes("STORY.map("));
  assert.match(manual, /My health, in \{STORY_COUNT\} questions<\/h2>/);
  assert.doesNotMatch(manual.replace(/\{HORIZON_PUBLIC\s*\?[\s\S]*?:\s*"/, ""), /can go to Horizon as a draft/, "the line about a draft on Horizon is said only once Horizon is offered");
  assert.ok(page.includes("{STORY.map((s, i) => ("), "the sign-in card lists the same parts");
});

test("Help offers nothing of Horizon while it is not offered", () => {
  const answers = HELP_DOORS.flatMap((d) => d.questions).map((q) => `${q.q} ${q.a} ${q.link?.label ?? ""}`).join(" ");
  assert.doesNotMatch(answers, /horizon/i);
  const pro = HELP_DOORS.flatMap((d) => d.questions).find((q) => q.q === "What does Pro add?");
  assert.equal(pro.a, "Free shows your numbers, and Pro reads them: the Guide's written reads, every retest and the longer history. Nothing free is taken away when a trial ends.");
  // the emails: true for a person with two and for a member with three
  const emails = HELP_DOORS.flatMap((d) => d.questions).find((q) => q.q === "I unsubscribed and still got one.");
  assert.equal(emails.a, "Each email has its own switch: the weekly letter is one, Your week on Mondays is another. Turning one off leaves the others as they were.");
});

test("inside My health the tab is not drawn until the page knows the account has Horizon, and no address reaches it otherwise", () => {
  assert.match(page, /<button type="button" class="mh-tab" data-tab="horizon" id="horizontab" style="display:none">/);
  assert.match(page, /\$\("horizontab"\)\.style\.display = on \? "" : "none";/);
  assert.match(page, /if \(t === "horizon" && !horizonDoor\.value\) t = "overview";/, "setTab: any way in lands on the Overview");
  assert.match(page, /if \(tab === "horizon" && !horizonDoor\.value\) \{ setTab\("overview"\); wantHorizon\(wanted\); return; \}/, "an address on Horizon waits for the answer");
  assert.match(page, /function openHorizon\(hash: string\) \{\s*if \(!horizonDoor\.value\) return;/);
  assert.match(page, /if \(!on && activeTab === "horizon"\) \{ quietly\(\(\) => setTab\("overview"\)\); return; \}/, "the door closing under someone on the tab");
  // "Set a horizon" in the sidebar only where one would be started
  assert.match(page, /if \(horizonSettable\.value\) rows\.push\(`<button type="button" class="mh-sub" data-tab-for="horizon" data-horizon="new">/);
  // the door is one computed answer, from the one rule
  const state = read("../src/my-health/state.ts");
  assert.match(state, /export const horizonDoor = computed\(\(\) => hasHorizon\(\{\s*open: HORIZON_PUBLIC,\s*programme: isTester\.value,/);
  assert.match(state, /horizons\.value\.filter\(isShownHorizon\)\.length/);
});

test("the pane itself holds nothing for an account without Horizon, and offers a new one only where it would be started", () => {
  const view = read("../src/my-health/views/Horizon.tsx");
  assert.match(view, /if \(!horizonDoor\.value\) return null;/);
  assert.match(view, /const canSet = maySetHorizon\(\{ open: HORIZON_PUBLIC, programme: tester, owner \}\);/);
  assert.match(view, /const showSetup = canSet && \(/);
  assert.match(view, /\{canSet && <button type="button" role="tab" aria-selected=\{showSetup\}/);
  assert.match(view, /\{canSet && prefill && \(later/, "a horizon read to its date offers the next one only then");
});

test("the other doors: a line of the Guide's, Settings, and the weekly email's words", () => {
  const reads = read("../src/my-health/views/Reads.ts"), settings = read("../src/my-health/views/Settings.tsx");
  assert.match(reads, /const canTarget = horizonSettable\.value \|\| \(horizons\.value \?\? \[\]\)\.some\(\(h\) => !h\.closed_at\);/);
  assert.match(reads, /: ctx!\.owner && canTarget \? `<button type="button" data-target=/, "'Make it a target' only where a target can be made");
  assert.match(settings, /const withHorizon = HORIZON_PUBLIC \|\| isTester\.value \|\| open\.length > 0;/);
  assert.match(settings, /\{withHorizon \? <div class="border-t border-border py-3">\s*<div class="text-\[15px\] font-medium text-text">Horizon check-ins<\/div>/);
  assert.match(settings, /\{withHorizon \? WEEKLY_CARRIES : WEEKLY_CARRIES_PLAIN\}/);
  assert.match(WEEKLY_CARRIES, /your horizon's pace/); assert.doesNotMatch(WEEKLY_CARRIES_PLAIN, /horizon/i);
  assert.match(settings, /\{horizonSettable\.value \? <> <button type="button" onClick=\{deps\.goHorizon\}/, "'Set one on Horizon' is not a button that is refused");
  // the trial's line names what the trial opens
  assert.match(settings, /"Pro on the website: the Guide's reads and In depth, here\."/);
});

test("once Pro has ended, a person who keeps a horizon reads one line and is shown nothing to buy", () => {
  assert.equal(HORIZON_KEPT, "Your horizon stays here to read, with its targets and your readings. The Guide's plan and the Monday check-in have stopped, and Horizon is not open to new members at the moment.");
  assert.doesNotMatch(HORIZON_KEPT, /plans?\b.*(see|buy)|upgrade|subscri|[$€£₹]|price|\bmet\b/i);
  const view = read("../src/my-health/views/Horizon.tsx"), plan = read("../src/my-health/views/GuidePlan.tsx");
  assert.match(view, /if \(!HORIZON_PUBLIC\) return <Card><p [^>]*data-horizon-kept>\{HORIZON_KEPT\}<\/p><\/Card>;/, "in place of 'Horizon is part of Pro'");
  assert.match(plan, /if \(!HORIZON_PUBLIC\) return <p [^>]*data-horizon-kept>\{HORIZON_KEPT\}<\/p>;/, "in place of the locked plan's card");
});

test("/horizon: the five questions are for an account the programme is on for; anyone else reads that it is not open yet", () => {
  const src = read("../src/pages/horizon.astro");
  assert.match(src, /\{!HORIZON_PUBLIC && \(\s*<header class="[^"]*" data-horizon-closed>/);
  assert.match(src, />Horizon is not open yet\.<\/h1>/);
  assert.match(src, /<header class="[^"]*" data-horizon-open hidden=\{!HORIZON_PUBLIC\}>/);
  assert.match(src, /<div class="[^"]*" data-horizon-open hidden=\{!HORIZON_PUBLIC\}>\s*<div id="questions"/, "the questions are served hidden");
  assert.match(src, /<LetterBox questions="#questions" third=\{HORIZON_PUBLIC\} \/>/, "the letter's box stays, without its third thing to do");
  assert.match(src, /noindex/);
  // the gate is the database's answer, asked as /plans asks about its chart
  assert.match(src, /import \{ accessAnswer \} from "\.\.\/my-health\/horizon\/api\.ts";/);
  assert.match(src, /if \(!uid\) return;/, "signed out: the page stays closed");
  assert.match(src, /const answer = await accessAnswer\(supabase, uid\);\s*if \(answer == null\) return;/, "an ask that failed changes nothing");
  assert.match(src, /const flags = accessFlags\(answer\);\s*remember\(uid, flags\);\s*show\(on\(flags\)\);/);
  // a member still reaches it from their horizon's set-up
  assert.match(read("../src/my-health/views/Programme.tsx"), /href="\/horizon\/"/);
  // the closed page promises nothing and names no price
  const closed = src.slice(src.indexOf("data-horizon-closed"), src.indexOf("data-horizon-open"));
  assert.doesNotMatch(closed, /soon|waitlist|invit|[$€£₹]|price/i);
});

test("the Pro sheet and the trial say nothing of Horizon while it is not offered", () => {
  const sheet = read("../src/my-health/views/PlanSheet.tsx");
  assert.match(sheet, /\{PRO_SHEET_LINE\}/);
  assert.doesNotMatch(sheet.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), /Horizon/);
});

test("'test account' is our own note: where a founding member also reads the page, only one of Verve's accounts is shown it", () => {
  const dir = "../src/my-health/views/";
  // the programme's set-up, the fitness card and its button are a founding member's too
  assert.match(read(`${dir}Programme.tsx`), /<Eyebrow>Horizon · new\{isTeam\.value \? " · test account" : ""\}<\/Eyebrow>/);
  assert.match(read(`${dir}FitnessEntry.tsx`), /const ours = isTeam\.value \? " · test account" : "";/);
  assert.match(read(`${dir}Horizon.tsx`), /\{isTeam\.value \? " Test account\." : ""\}<\/span>/);
  for (const f of ["Programme.tsx", "FitnessEntry.tsx", "Horizon.tsx"]) {
    const drawn = read(`${dir}${f}`).split("\n").filter((l) => /test account/i.test(l) && !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l) && !/\/\*\*.*test account.*\*\//i.test(l) && !/\/\/.*test account/i.test(l));
    // the call sheet's note is drawn from a flag its caller hands it as "the team's alone" (below)
    for (const l of drawn.filter((x) => !/owner && tester \? <Quiet>Test account: you can write the coach's side/.test(x))) assert.match(l, /isTeam\.value/, `${f}: "${l.trim().slice(0, 80)}" is shown to a founding member`);
  }
  // writing the coach's side of one's own horizon is a way to try the sheet alone: the team's, not a member's
  assert.match(read(`${dir}Horizon.tsx`), /<CallCard [^>]*tester=\{tester && isTeam\.value\}/);
});

// ── Found by walking the preview in the founder's own browser, 26 November 2026 ──

test("a row of the side list marked hidden is not drawn: the row's own rule does not win over it", () => {
  // every row is drawn by one rule that carries an id; a bare .hidden class loses to it, so the rule has a partner.
  // Without the partner every account saw "Your offer" and "For the team" in Settings (14 to 26 November 2026).
  assert.match(page, /:is\(#tabbar, #settingsnav\) \.mh-tab \{ display: flex;/);
  assert.match(page, /:is\(#tabbar, #settingsnav\) \.mh-tab\.hidden \{ display: none; \}/);
  // the two rows that are the team's start hidden, and the page shows them only for a team account
  for (const id of ["settingsoffernav", "settingsteamnav"]) assert.match(page, new RegExp('id="' + id + '" class="mh-tab hidden"'));
  assert.match(page, /\$\("settingsteamnav"\)\.classList\.toggle\("hidden", !isTeamSignal\.value\)/);
});

test("choosing a preview on the team's page moves to Plan and billing, a page the previewed person has", () => {
  assert.match(page, /view !== "team" && activeTab === "settings" && \(settingsSection === "team" \|\| settingsSection === "offer"\)\) openSettings\("plan"\)/);
});

test("a kept horizon does not say the Guide still checks it, and no horizon's page sells Horizon as part of Pro while it is not offered", () => {
  const view = read("../src/my-health/views/Horizon.tsx");
  assert.match(view, /const keptOnly = locked && !HORIZON_PUBLIC;/);
  // the sentence is written in two places below the door's card, and both leave it out for a kept horizon
  assert.equal((view.match(/keptOnly \? (?:""|null) : /g) ?? []).length, 2);
  assert.match(view, /on\("notes"\) && HORIZON_PUBLIC \? /);
});
