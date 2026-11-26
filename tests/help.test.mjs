// Help (board 33 of "Verve, Horizon as a programme"): six doors, short answers that are true and end at the place
// where the thing is done, and a form that adds only what it shows. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { HELP_DOORS, HELP_EMAIL, HELP_VIEWS, WRITE_ID, doorOf } from "../src/data/help.ts";
import { HELP_LIMITS, addedWords, browserWords, checkHelp, helpBody, isRelay, needsAddress, safePage } from "../src/help/form.ts";
import { FOOTER_LINKS, HELP_PATH, NAV, COMPANY } from "../src/data/site.ts";
import { SETTINGS_SECTIONS } from "../src/my-health/account.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const has = (p) => existsSync(new URL(`../${p}`, import.meta.url));
const all = HELP_DOORS.flatMap((d) => d.questions.map((x) => ({ door: d.id, ...x })));
const myHealth = read("src/pages/my-health.astro");
const help = read("src/pages/help.astro");

test("six doors, in the board's order, and twenty-two questions behind them", () => {
  assert.deepEqual(HELP_DOORS.map((d) => d.id), ["numbers", "signing-in", "reports", "sharing", "plan", "data"]);
  assert.deepEqual(HELP_DOORS.map((d) => d.questions.length), [4, 4, 4, 3, 4, 3]);
  assert.equal(all.length, 22);
  assert.equal(new Set(all.map((x) => x.q)).size, 22, "no question is asked twice");
  assert.deepEqual(HELP_VIEWS, ["help", "numbers", "signing-in", "reports", "sharing", "plan", "data", "write"]);
  assert.equal(doorOf("signing-in")?.title, "Signing in");
  assert.equal(doorOf("nowhere"), undefined);
  assert.ok(HELP_DOORS.every((d) => /^[a-z]+(-[a-z]+)*$/.test(d.id) && d.title && d.blurb.endsWith(".")));
});

test("an answer is one or two sentences, with one link at its end", () => {
  for (const x of all) {
    const sentences = x.a.split(/(?<=[.!?])\s+/).filter(Boolean);
    assert.ok(sentences.length >= 1 && sentences.length <= 2, `"${x.q}" runs to ${sentences.length} sentences`);
    assert.ok(x.a.length <= 280, `"${x.q}" is ${x.a.length} characters`);
    assert.ok(x.link && x.link.label && x.link.href, `"${x.q}" has its link`);
    assert.ok(!/https?:|\bwww\./.test(x.a), `"${x.q}" carries no address in its words: the link does that`);
    assert.ok(/[.?]$/.test(x.q), `"${x.q}" ends as a sentence`);
  }
});

test("every link is an address this site serves, and a place the signed-in page knows", () => {
  const tabs = /const TABS = \[([^\]]+)\]/.exec(myHealth)[1].split(",").map((s) => s.trim().replace(/"/g, ""));
  const sections = SETTINGS_SECTIONS.map(([k]) => k);
  const pages = { "/": "src/pages/index.astro", "/my-health/": "src/pages/my-health.astro", "/how-it-works": "src/pages/how-it-works.astro", "/plans": "src/pages/plans.astro", "/privacy/": "public/privacy/index.html" };
  for (const x of all) {
    const href = x.link.href;
    if (href === `#${WRITE_ID}`) continue;                       // the form on the Help page itself
    const [path, hash = ""] = href.split("#");
    assert.ok(pages[path], `"${x.q}" links to ${path}, which is not a page listed here`);
    assert.ok(has(pages[path]), `${pages[path]} is in the repo`);
    if (path === "/my-health/" && hash) {
      const [tab, ...rest] = hash.split("-");
      assert.ok(tabs.includes(tab), `#${hash}: My health has no "${tab}"`);
      if (tab === "settings") assert.ok(sections.includes(rest.join("-")), `#${hash}: Settings has no such section`);
      else assert.equal(rest.length, 0, `#${hash}`);
    }
    if (path === "/how-it-works" && hash) assert.match(read(pages[path]), new RegExp(`id: "${hash}"`), `How it works has a section ${hash}`);
    if (path === "/" && hash) assert.match(read("src/components/FirstNumber.astro"), new RegExp(`id="${hash}"`));
  }
  // the page nobody links to yet stays unlinked (tests/programme.test.mjs)
  assert.ok(all.every((x) => !x.link.href.startsWith("/horizon")));
});

test("no answer gives advice about health, promises a reply, or uses a word the site has retired", () => {
  for (const x of all) {
    const words = `${x.q} ${x.a} ${x.link.label}`;
    for (const rx of [/\byou should\b/i, /\bdiagnos/i, /\btreat(ment)?\b/i, /\bmedic(ine|ation)\b/i, /\bconsult\b/i, /\brisk\b/i, /\bhealthy\b/i, /within \w+ (working )?days?/i, /—/, /\bgoal (was |is )?met\b/i])
      assert.ok(!rx.test(words), `"${x.q}" carries ${rx}`);
  }
  assert.match(help, /It does not give medical advice\. If you feel unwell, contact a doctor or your local emergency number\./);
});

// An answer leans on the product's own words. When one of these lines changes in the product, the test fails and
// the answer is read again against the code (data/help.ts names the source above each answer).
test("the product still says what the answers say it says", () => {
  const settings = read("src/my-health/views/Settings.tsx");
  for (const [file, text, phrases] of [
    ["views/Overview.tsx", read("src/my-health/views/Overview.tsx"), ["reads a dash and the reason, never a zero", "Verve's own test · no wearable needed"]],
    ["derive/fitness.ts", read("src/my-health/derive/fitness.ts"), ["such estimates miss the lab figure by 7 to 16 % on average"]],
    ["views/Settings.tsx", settings, ["Where you bought decides where you manage it: the App Store, Google Play, or here. It is the same Pro in all three.", "every email turns itself off in one click", "Back up watch readings in the app", "which is off unless you switch it on", "the Guide's reads and Horizon", "the Guide's reads and In depth"]],
    ["pages/my-health.astro", myHealth, ["It expires in one hour", "Resend the code", "a code cannot reach an address Apple hides", "an address Apple made to hide your own", "The same sign-in as the app. The name is the one the app greets you with.", "A PDF, a photo of the report as JPG, PNG or WebP", "up to 15 MB each", "originals stay in your private archive", "check anything Verve misread", "Untick to leave this value out", "GOES TO YOUR APP", "STAYS ON THE WEBSITE", "The PDF is removed; its values stay", "Send the invitation", "Nothing is shared until they open it", "They can look, not change", "Export as CSV", "Export as JSON", "Everything on this account goes with it, here and in the app. It cannot be undone.", "merge_accounts_by_email"]],
    ["views/Reports.tsx", read("src/my-health/views/Reports.tsx"), ["Read again", "awaiting your check there"]],
    ["pages/how-it-works.astro", read("src/pages/how-it-works.astro"), ["free shows your numbers, Pro reads them. Nothing free is taken away when a trial ends.", "reads the phone's health store and nothing else"]],
    ["components/FirstNumber.astro", read("src/components/FirstNumber.astro"), ["Six-minute walk", "Twelve-minute run"]],
    ["pages/unsubscribe.astro", read("src/pages/unsubscribe.astro"), ["newsletter_unsubscribe", "weekly_email_off", "horizon_email_off"]],
    ["public/privacy", read("public/privacy/index.html"), ["your newsletter sign-up", "Email us to have particular values removed"]],
  ]) for (const p of phrases) assert.ok(text.includes(p), `${file} no longer says "${p}": read the answer that leans on it again`);
  const scopes = read("src/my-health/derive/scopes.ts");
  for (const label of ["Labs", "Imaging", "Activity and fitness", "Body measurements", "Sleep and heart"]) assert.ok(scopes.includes(`"${label}"`), label);
  assert.match(myHealth, /data-change="\$\{g\.id\}"/); assert.match(myHealth, /data-stop="\$\{g\.id\}"/);
});

test("Help is reached from the footer, the account menu and the sign-in card; How it works keeps its place", () => {
  assert.equal(HELP_PATH, "/help");
  assert.equal(FOOTER_LINKS.at(-1)?.href, "/help");
  assert.ok(NAV.some((l) => l.href === "/how-it-works") && !NAV.some((l) => l.href === HELP_PATH), "the bar is as it was");
  assert.match(myHealth, /<a role="menuitem" class="mh-menuitem" id="helpgo" href="\/help\/">/);
  assert.ok(!/class="mh-menuitem"[^>]*href="\/how-it-works\/"/.test(myHealth), "the menu's Help no longer opens the videos");
  assert.match(myHealth, /href="\/help\/#signing-in"[^>]*>Trouble signing in\?<\/a>/);
  assert.match(help, /href="\/how-it-works"[^>]*>New here\? See how the app works/);
  assert.ok(!/noindex/.test(help.split("---")[2] ?? help), "open to anyone and to search");
  assert.equal(HELP_EMAIL, COMPANY.email);
});

test("the page draws every door from the data, one small page at a time, and each has its own address", () => {
  assert.match(help, /\{HELP_DOORS\.map\(\(d\) => \(\s*<section id=\{d\.id\} data-help-view=\{d\.id\}/);
  assert.match(help, /main\[data-js\] \[data-help-view\]:not\(\[data-on\]\) \{ display: none; \}/);
  assert.match(help, /name: `help-\$\{d\.id\}`/, "behind a door, one question is open at a time");
  assert.match(help, /<noscript>/, "without a script the form says where to write instead");
  // an address that opens on the form (/help/#write) needs the whole script read first: the first show() is its last line
  assert.match(help, /\n  show\(false\);\n<\/script>/);
  assert.match(help, /main\[data-js\] \[data-help-view\] \{ scroll-margin-top: 100vh; \}/, "a named page starts at the top");
});

// ── the form ───────────────────────────────────────────────────────────────────────────────
const OUT = { signedIn: false, ownEmail: "" }, IN = { signedIn: true, ownEmail: "asha@example.com" }, RELAY = { signedIn: true, ownEmail: "k7x2@privaterelay.appleid.com" };
const typed = { doing: "Open the list under Settings.", saw: "A page that said there was nothing on it.", email: "" };

test("a reply needs an address: asked for when nobody is signed in, or when Apple hides the account's", () => {
  assert.equal(needsAddress(OUT), true);
  assert.equal(needsAddress(IN), false);
  assert.equal(needsAddress(RELAY), true);
  assert.equal(needsAddress({ signedIn: true, ownEmail: "" }), true);
  assert.ok(isRelay("K7@PrivateRelay.AppleID.com") && !isRelay("asha@example.com"));
});

test("the form is checked before anything is sent, and says which box", () => {
  assert.deepEqual(checkHelp({ ...typed, ...IN }), { ok: true, email: "asha@example.com" });
  assert.deepEqual(checkHelp({ ...typed, email: " Visitor@Example.com ", ...OUT }), { ok: true, email: "visitor@example.com" });
  assert.deepEqual(checkHelp({ ...typed, email: "me@example.com", ...RELAY }), { ok: true, email: "me@example.com" });
  assert.equal(checkHelp({ ...typed, doing: " a ", ...IN }).field, "doing");
  assert.equal(checkHelp({ ...typed, saw: "", ...IN }).field, "saw");
  assert.equal(checkHelp({ ...typed, saw: "x".repeat(HELP_LIMITS.saw + 1), ...IN }).field, "saw");
  assert.equal(checkHelp({ ...typed, ...OUT }).field, "email", "signed out, no address");
  assert.equal(checkHelp({ ...typed, email: "nope", ...OUT }).field, "email");
  assert.match(checkHelp({ ...typed, email: "x@privaterelay.appleid.com", ...RELAY }).error, /Apple hides/);
  assert.equal(checkHelp({ ...typed, email: "ignored@example.com", ...IN }).email, "asha@example.com", "signed in with a reachable address: the account's is used");
});

test("the page a person came from is this site's own path: no host, no query, and no id from a horizon's address", () => {
  const O = "https://verve-app.health";
  assert.equal(safePage("/my-health/#settings-team", O), "/my-health/#settings-team");
  assert.equal(safePage(`${O}/science/fitness/vo2max`, O), "/science/fitness/vo2max");
  assert.equal(safePage(`${O}/unsubscribe/?t=0123456789abcdef0123456789abcdef0123`, O), "/unsubscribe/", "a token in the address never travels");
  assert.equal(safePage("/my-health/#horizon-3f2a9c1e-aaaa-4bbb-8ccc-0123456789ab", O), "/my-health/#horizon");
  assert.equal(safePage("/my-health/#horizon-deadbeef-dead-beef-dead-beefdeadbeef", O), "/my-health/#horizon", "even an id made of letters");
  assert.equal(safePage("/my-health/#horizon-new", O), "/my-health/#horizon-new");
  assert.equal(safePage("/my-health/#overview-movement", O), "/my-health/#overview-movement");
  assert.equal(safePage("/my-health/#x1y2", O), "/my-health/", "a hash that is not plain words is dropped");
  for (const bad of ["https://example.com/my-health/", "", "/help/", "/help", "javascript:alert(1)"]) assert.equal(safePage(bad, O), null, String(bad));
});

test("the browser is a few words, never the string it sends", () => {
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
  assert.equal(browserWords(mac), "Chrome on a Mac");
  assert.equal(browserWords(mac, { brave: true }), "Brave on a Mac");
  assert.equal(browserWords("Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1"), "Safari on an iPhone");
  assert.equal(browserWords("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0"), "Firefox on Windows");
  assert.equal(browserWords("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0"), "Edge on Windows");
  assert.equal(browserWords("Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36"), "Chrome on Android");
  assert.equal(browserWords(""), "");
  for (const ua of [mac]) assert.ok(browserWords(ua).length <= HELP_LIMITS.browser && !/\d/.test(browserWords(ua)), "no version, no build");
});

test("what is added is shown first, and nothing is added when the box is unticked", () => {
  assert.equal(addedWords({ page: "/my-health/#settings-team", browser: "Brave on a Mac" }), "This will be added: the page you came from (/my-health/#settings-team) and your browser (Brave on a Mac).");
  assert.equal(addedWords({ page: null, browser: "Safari on an iPhone" }), "This will be added: your browser (Safari on an iPhone).");
  assert.match(addedWords({ page: null, browser: "" }), /^Nothing can be added/);
  const base = { doing: " a b c ", saw: " d e f ", email: "asha@example.com", page: "/my-health/#reports", browser: "Chrome on a Mac", website: "" };
  assert.deepEqual(helpBody({ ...base, add: true }), { doing: "a b c", saw: "d e f", email: "asha@example.com", website: "", page: "/my-health/#reports", browser: "Chrome on a Mac" });
  assert.deepEqual(helpBody({ ...base, add: false }), { doing: "a b c", saw: "d e f", email: "asha@example.com", website: "" });
  assert.deepEqual(Object.keys(helpBody({ ...base, add: true })).sort(), ["browser", "doing", "email", "page", "saw", "website"], "nothing else can travel");
});

test("the form never says sent for a message nobody will see, and says where to write instead", () => {
  assert.match(help, /if \(!error && data\?\.sent === true\)/);
  assert.match(help, /supabase\.functions\.invoke\("help-message"/);
  assert.match(help, /id="helpfail" role="alert"/);
  assert.match(help, /and it reaches the same inbox\. What you typed is still in the boxes above\./);
  assert.match(help, /id="helpwebsite" name="website" type="text" tabindex="-1" autocomplete="off"/, "the field no person sees");
  assert.match(help, /Never added: any of your figures\./);
  assert.ok(!/console\.(log|error)/.test(help));
});
