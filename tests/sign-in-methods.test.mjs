// Settings › Profile › Sign-in methods: the doors an account has, what the email door asks for, what a refusal
// means in plain words, the trip to Apple's or Google's page and back, and the calls, against a client that is
// not a server. The fixture person is Asha. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DOORS, DOOR_NAME, MIN_PASSWORD, PASSWORD_FLAG, PENDING_LINK, PENDING_LINK_MAX_MS, EMAIL_KEPT_BY_LIST, EMAIL_NOT_CHECKED,
  doorsOf, emailPlan, isRelayEmail, listFromPlan, looksLikeEmail, maskEmail, troubleOf, troubleWords, addedWords,
  pendingLinkValue, readLinkBack, secondCodeWords,
} from "../src/my-health/signInMethods.ts";
import {
  readAccount, startProviderLink, sendEmailCode, resendEmailCode, confirmEmailCode, emailIsNow, setPassword,
} from "../src/my-health/signInMethodsApi.ts";

const RELAY = "x7k2m9@privaterelay.appleid.com";
/** Asha signed in with Apple and "Hide My Email": the case this exists for. */
const HIDDEN = { id: "u-asha", email: RELAY, email_confirmed_at: "2026-10-01T08:00:00Z", identities: [{ provider: "apple", identity_data: { email: RELAY } }], user_metadata: {} };
const GOOGLE = { id: "u-asha", email: "asha@example.com", email_confirmed_at: "2026-10-01T08:00:00Z", identities: [{ provider: "google", identity_data: { email: "asha@example.com" } }], user_metadata: {} };
const has = (u) => Object.fromEntries(doorsOf(u).map((d) => [d.door, d.has]));
const NOW = Date.parse("2026-11-28T08:00:00Z");

// ── the doors ───────────────────────────────────────────────────────────────

test("the three doors are always listed, in one order", () => {
  assert.deepEqual(doorsOf(null).map((d) => d.door), ["apple", "google", "email"]);
  assert.deepEqual([...DOORS], ["apple", "google", "email"]);
  assert.equal(DOOR_NAME.email, "Email and password");
});

test("an Apple account with its email hidden has Apple alone, and the hidden address is never printed", () => {
  assert.deepEqual(has(HIDDEN), { apple: true, google: false, email: false });
  assert.equal(doorsOf(HIDDEN)[0].detail, "with your email hidden");
  assert.ok(!JSON.stringify(doorsOf(HIDDEN)).includes("privaterelay"));
});

test("Google added to that account: two doors, and Google's own address beside it", () => {
  const both = { ...HIDDEN, identities: [...HIDDEN.identities, { provider: "google", identity_data: { email: "asha@example.com" } }] };
  assert.deepEqual(has(both), { apple: true, google: true, email: false });
  assert.deepEqual(doorsOf(both)[1], { door: "google", has: true, detail: "asha@example.com" });
});

test("a password set here counts as the email door, where the server made no identity for it", () => {
  const withPassword = { ...GOOGLE, user_metadata: { [PASSWORD_FLAG]: true } };
  assert.deepEqual(has(withPassword), { apple: false, google: true, email: true });
  assert.equal(doorsOf(withPassword)[2].detail, "asha@example.com");
  assert.equal(has({ ...GOOGLE, user_metadata: { [PASSWORD_FLAG]: "yes" } }).email, false);
});

// ── the email door ──────────────────────────────────────────────────────────

test("the email door asks for a real address first when the account's own is one Apple made", () => {
  assert.deepEqual(emailPlan(HIDDEN), { kind: "email-first", hidden: true });
  assert.ok(isRelayEmail(RELAY) && !isRelayEmail("asha@example.com"));
});

test("and only for a password when the account's email is its own and confirmed", () => {
  assert.deepEqual(emailPlan(GOOGLE), { kind: "password", email: "asha@example.com" });
  assert.deepEqual(emailPlan({ email: "asha@example.com", email_confirmed_at: null }), { kind: "email-first", hidden: false });
  assert.deepEqual(emailPlan(null), { kind: "email-first", hidden: false });
});

test("the password floor is the sign-up card's own", () => {
  const page = readFileSync(new URL("../src/pages/my-health.astro", import.meta.url), "utf8");
  assert.ok(page.includes(`if (password.length < ${MIN_PASSWORD}) { msg("authmsg", "Choose a password of at least ${MIN_PASSWORD} characters.", true); return; }`));
});

test("an account whose Pro or programme place is kept by its email is not offered a change of email", () => {
  assert.equal(listFromPlan({ through: "founding" }), "listed");
  assert.equal(listFromPlan({ through: "vip" }), "listed");
  assert.equal(listFromPlan({ through: "app" }), "not-listed");
  assert.equal(listFromPlan({ through: "web" }), "not-listed");
  assert.equal(listFromPlan({ through: "trial" }), "not-listed");
  assert.equal(listFromPlan({ through: null }), "not-listed");              // Free: nothing hangs on the email
  assert.equal(listFromPlan(null), "unknown");                               // the server has not said: no change either
  assert.equal(listFromPlan(undefined), "unknown");
  assert.equal(EMAIL_KEPT_BY_LIST, "Your Pro or your place in the programme is kept by this account's email, so it cannot be changed here. Add Google instead, or ask Verve to move it.");
  assert.equal(EMAIL_NOT_CHECKED, "Verve could not check your plan just now. Try again in a moment. Nothing was changed.");
});

test("the second code is asked for without ever printing an address Apple made", () => {
  assert.equal(secondCodeWords(RELAY), "One more code. Verve also sent one to the address Apple keeps for you. It arrives in your own inbox. Enter that one.");
  assert.ok(!secondCodeWords(RELAY).includes("privaterelay"));
  assert.equal(secondCodeWords("asha@example.com"), "One more code. Verve also sent one to the address this account has now (a•••@example.com). Enter that one.");
});

test("an address is read loosely and shown without printing it whole", () => {
  assert.ok(looksLikeEmail(" asha@example.com "));
  assert.ok(!looksLikeEmail("asha@example") && !looksLikeEmail("asha example.com"));
  assert.equal(maskEmail("asha@example.com"), "a•••@example.com");
});

// ── refusals ────────────────────────────────────────────────────────────────

test("each refusal the server can give is read to its meaning", () => {
  const cases = [
    [{ code: "manual_linking_disabled", message: "Manual linking is disabled", status: 404 }, "not-ready"],
    [{ code: "identity_already_exists", message: "Identity is already linked to another user" }, "belongs-elsewhere"],
    [{ code: "identity_already_exists", message: "Identity is already linked" }, "already-here"],
    [{ code: "email_exists", message: "A user with this email address has already been registered" }, "email-elsewhere"],
    [{ code: "otp_expired", message: "Token has expired or is invalid" }, "bad-code"],
    [{ message: "Email link is invalid or has expired" }, "bad-code"],
    [{ code: "weak_password" }, "weak-password"],
    [{ code: "same_password" }, "same-password"],
    [{ code: "current_password_required" }, "has-password"],
    [{ code: "reauthentication_needed" }, "fresh-sign-in"],
    [{ code: "over_email_send_rate_limit", status: 429 }, "too-many"],
    [{ status: 429 }, "too-many"],
    [{ code: "email_address_invalid" }, "bad-email"],
    [{ name: "AuthRetryableFetchError", message: "Failed to fetch" }, "offline"],
    [{ code: "something_new", message: "pq: relation does not exist" }, "unknown"],
    [null, "unknown"], ["a string", "unknown"],
  ];
  for (const [err, want] of cases) assert.equal(troubleOf(err), want, JSON.stringify(err));
});

test("every refusal has one plain line for every door: no code, no server text, no exclamation", () => {
  const all = ["not-ready", "belongs-elsewhere", "already-here", "email-elsewhere", "same-email", "bad-email", "bad-code", "weak-password",
    "same-password", "has-password", "fresh-sign-in", "too-many", "offline", "unknown"];
  for (const door of DOORS) for (const t of all) {
    const w = troubleWords(t, door);
    assert.ok(w.length > 10 && w.length < 130, w);
    assert.ok(!/[_!{}]|error|identity|supabase|undefined|null/i.test(w), w);
    assert.ok(w.endsWith("."), w);
  }
  assert.equal(troubleWords("belongs-elsewhere", "google"), "That Google account already opens a different Verve account. Nothing was changed.");
  assert.equal(troubleWords("not-ready", "apple"), "Verve is not ready to add a sign-in method yet. Nothing was changed.");
  assert.equal(troubleWords("bad-code", "email"), "That code was wrong or too old. Ask for a new one.");
  assert.equal(addedWords("google"), "Added. You can now sign in with Google.");
  assert.equal(addedWords("email", "asha@example.com"), "Added. You can now sign in with asha@example.com and your password.");
});

// ── the trip to Apple's or Google's page and back ───────────────────────────

test("a return with a code, while a door was being added, is that door coming back: the account is then read", () => {
  const note = pendingLinkValue("google", NOW - 40_000);
  assert.deepEqual(readLinkBack("https://verve-app.health/my-health/?code=abc123", note, NOW), { door: "google", trouble: null });
});

test("a return with an error says whose account it is", () => {
  const note = pendingLinkValue("google", NOW - 40_000);
  const href = "https://verve-app.health/my-health/?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user";
  assert.deepEqual(readLinkBack(href, note, NOW), { door: "google", trouble: "belongs-elsewhere" });
  const inHash = "https://verve-app.health/my-health/#error=access_denied&error_code=manual_linking_disabled&error_description=Manual+linking+is+disabled";
  assert.deepEqual(readLinkBack(inHash, pendingLinkValue("apple", NOW - 5_000), NOW), { door: "apple", trouble: "not-ready" });
});

test("a plain visit is nothing: no note, an old note, a note with nothing on the address, or an ordinary sign-in's code", () => {
  const fresh = pendingLinkValue("google", NOW - 40_000);
  assert.equal(readLinkBack("https://verve-app.health/my-health/?code=abc123", null, NOW), null);                    // an ordinary sign-in coming back
  assert.equal(readLinkBack("https://verve-app.health/my-health/", fresh, NOW), null);                               // the trip was given up on
  assert.equal(readLinkBack("https://verve-app.health/my-health/#settings-profile", fresh, NOW), null);
  assert.equal(readLinkBack("https://verve-app.health/my-health/?code=abc123", pendingLinkValue("google", NOW - PENDING_LINK_MAX_MS - 1), NOW), null);
  assert.equal(readLinkBack("https://verve-app.health/my-health/?code=abc123", "email:" + NOW, NOW), null);
  assert.equal(readLinkBack("https://verve-app.health/my-health/?code=abc123", "google:not-a-time", NOW), null);
  assert.equal(readLinkBack("not an address", fresh, NOW), null);
});

// ── the calls, against a client that is not a server ────────────────────────

/** A client that records what was asked of it and answers as told. Anything not named here throws if called. */
function client(answers = {}) {
  const calls = [];
  const auth = new Proxy({}, {
    get: (_t, name) => async (...args) => {
      calls.push([name, ...args]);
      if (!(name in answers)) throw new Error(`the client was asked for ${String(name)}, which nothing here should call`);
      const a = answers[name];
      if (a instanceof Error) throw a;
      return typeof a === "function" ? a(...args) : a;
    },
  });
  return { sb: { auth }, calls, asked: () => calls.map((c) => c[0]) };
}
const store = () => { const m = new Map(); return { m, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test("adding Google asks Supabase for Google's page for THIS account, landing where the sign-in lands, and keeps a note for the way back", async () => {
  const c = client({ linkIdentity: { data: { provider: "google", url: "https://accounts.google.com/x" }, error: null } });
  const keep = store();
  assert.deepEqual(await startProviderLink(c.sb, "google", "https://verve-app.health", keep, NOW), { ok: true });
  assert.deepEqual(c.calls, [["linkIdentity", { provider: "google", options: { redirectTo: "https://verve-app.health/my-health/" } }]]);
  assert.equal(keep.m.get(PENDING_LINK), `google:${NOW}`);
  // and the note it wrote is the note the return reads
  assert.deepEqual(readLinkBack("https://verve-app.health/my-health/?code=abc", keep.m.get(PENDING_LINK), NOW + 30_000), { door: "google", trouble: null });
});

test("with 'Allow manual linking' off the server refuses at once: said plainly, and no note is left behind", async () => {
  const c = client({ linkIdentity: { data: { provider: "apple", url: null }, error: { code: "manual_linking_disabled", message: "Manual linking is disabled", status: 404 } } });
  const keep = store();
  assert.deepEqual(await startProviderLink(c.sb, "apple", "https://verve-app.health", keep, NOW), { ok: false, trouble: "not-ready" });
  assert.equal(keep.m.has(PENDING_LINK), false);
  const thrown = client({ linkIdentity: new Error("Failed to fetch") });
  assert.deepEqual(await startProviderLink(thrown.sb, "google", "https://verve-app.health", keep, NOW), { ok: false, trouble: "offline" });
  assert.equal(keep.m.has(PENDING_LINK), false);
  // a browser that keeps nothing (private mode) still starts the trip
  const c2 = client({ linkIdentity: { data: { url: "https://accounts.google.com/x" }, error: null } });
  assert.deepEqual(await startProviderLink(c2.sb, "google", "https://verve-app.health", null, NOW), { ok: true });
});

test("the account is read from the server, and a server that does not answer is 'not read', never a guess", async () => {
  assert.deepEqual(await readAccount(client({ getUser: { data: { user: HIDDEN }, error: null } }).sb), HIDDEN);
  assert.equal(await readAccount(client({ getUser: { data: { user: null }, error: { message: "nope" } } }).sb), null);
  assert.equal(await readAccount(client({ getUser: new Error("Failed to fetch") }).sb), null);
});

test("a code is sent to a new address, and to nothing that is not one", async () => {
  const c = client({ updateUser: { data: { user: HIDDEN }, error: null } });
  assert.deepEqual(await sendEmailCode(c.sb, " asha@example.com ", RELAY), { ok: true });
  assert.deepEqual(c.calls, [["updateUser", { email: "asha@example.com" }]]);
  const none = client();
  assert.deepEqual(await sendEmailCode(none.sb, "asha at example", RELAY), { ok: false, trouble: "bad-email" });
  assert.deepEqual(await sendEmailCode(none.sb, RELAY.toUpperCase(), RELAY), { ok: false, trouble: "same-email" });
  assert.deepEqual(none.calls, []);
  const taken = client({ updateUser: { data: { user: null }, error: { code: "email_exists", message: "A user with this email address has already been registered", status: 422 } } });
  assert.deepEqual(await sendEmailCode(taken.sb, "asha@example.com", RELAY), { ok: false, trouble: "email-elsewhere" });
});

test("a code is checked as an email change, against the address it was sent to", async () => {
  const c = client({ verifyOtp: { data: { user: HIDDEN, session: { access_token: "a" } }, error: null } });
  assert.deepEqual(await confirmEmailCode(c.sb, "asha@example.com", "123 456"), { ok: true, done: true });
  assert.deepEqual(c.calls, [["verifyOtp", { email: "asha@example.com", token: "123456", type: "email_change" }]]);
  // a code taken with no session back: the other address has a code too
  const half = client({ verifyOtp: { data: { user: null, session: null }, error: null } });
  assert.deepEqual(await confirmEmailCode(half.sb, "asha@example.com", "123456"), { ok: true, done: false });
  const wrong = client({ verifyOtp: { data: { user: null, session: null }, error: { code: "otp_expired", message: "Token has expired or is invalid", status: 403 } } });
  assert.deepEqual(await confirmEmailCode(wrong.sb, "asha@example.com", "123456"), { ok: false, trouble: "bad-code" });
  const short = client();
  assert.deepEqual(await confirmEmailCode(short.sb, "asha@example.com", "12"), { ok: false, trouble: "bad-code" });
  assert.deepEqual(short.calls, []);
});

test("the code is sent again to the new address; a link pressed instead is believed when the account says so", async () => {
  const c = client({ resend: { data: {}, error: null } });
  assert.deepEqual(await resendEmailCode(c.sb, "asha@example.com"), { ok: true });
  assert.deepEqual(c.calls, [["resend", { type: "email_change", email: "asha@example.com" }]]);
  assert.equal(await emailIsNow(client({ getUser: { data: { user: HIDDEN }, error: null } }).sb, "asha@example.com"), false);
  assert.equal(await emailIsNow(client({ getUser: { data: { user: { ...HIDDEN, email: "Asha@Example.com" } }, error: null } }).sb, "asha@example.com"), true);
});

test("the password is set with the mark that says the account has one; a short one is not sent", async () => {
  const c = client({ updateUser: { data: { user: GOOGLE }, error: null } });
  assert.deepEqual(await setPassword(c.sb, "a-long-password"), { ok: true });
  assert.deepEqual(c.calls, [["updateUser", { password: "a-long-password", data: { [PASSWORD_FLAG]: true } }]]);
  const none = client();
  assert.deepEqual(await setPassword(none.sb, "short"), { ok: false, trouble: "weak-password" });
  assert.deepEqual(none.calls, []);
  const wants = client({ updateUser: { data: { user: null }, error: { code: "reauthentication_needed", status: 400 } } });
  assert.deepEqual(await setPassword(wants.sb, "a-long-password"), { ok: false, trouble: "fresh-sign-in" });
});

test("no call here signs anyone out, signs in, sets a session or takes a door away", async () => {
  // the client above throws for anything it was not told to answer, so each test already proves it for its own
  // call; this reads the two files for the words themselves
  for (const f of ["../src/my-health/signInMethodsApi.ts", "../src/my-health/signInMethods.ts", "../src/my-health/views/SignInMethods.tsx"]) {
    const code = readFileSync(new URL(f, import.meta.url), "utf8").split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
    assert.ok(!/unlinkIdentity|\.signOut\(|\.setSession\(|signInWithOAuth|signInWithPassword|signInWithOtp|signInWithIdToken/.test(code), f);
  }
});

// ── where the page is joined to it ──────────────────────────────────────────

test("the page: one place in the Profile card, the note read once before the address is tidied away, the block shown for the signed-in account", () => {
  const page = readFileSync(new URL("../src/pages/my-health.astro", import.meta.url), "utf8");
  // under "Signed in with", inside the Profile card
  const who = page.indexOf('id="whoamiaddr"'), root = page.indexOf('<div id="setsigninroot"></div>'), end = page.indexOf('id="settings-plan"');
  assert.ok(who > -1 && root > who && root < end);
  // the address is read while it still carries what came back, and the note is thrown away as it is read
  const read = page.indexOf("const cameBack = readLinkBack(url.href, linkNote, Date.now());");
  assert.ok(read > -1);
  assert.ok(page.indexOf("const url = new URL(location.href);") < read);
  assert.ok(page.includes("linkNote = localStorage.getItem(PENDING_LINK); if (linkNote) localStorage.removeItem(PENDING_LINK);"));
  assert.ok(page.includes('if (cameBack) { linkBack.value = cameBack; history.replaceState(null, "", location.pathname + "#settings-profile"); }'));
  // it is read before the page decides which tab to open
  assert.ok(read < page.indexOf("const wanted = window.location.hash.replace"));
  // the signed-in account is handed to the block, and nobody's account is left in it after a sign-out
  assert.ok(page.includes("showWhoAmI(session.user);\n      signInView.show(session.user);"));
  assert.ok(page.includes("people = []; person = null;\n      signInView.show(null);"));
  // an ordinary sign-in's note for the last door used is not touched by adding one
  const api = readFileSync(new URL("../src/my-health/signInMethodsApi.ts", import.meta.url), "utf8");
  assert.ok(!api.includes("verve:pending-sign-in") && !api.includes("verve:last-sign-in"));
});

test("the block draws a refusal as quiet words in the card's own type, and offers the email field only after the plan is asked", () => {
  const view = readFileSync(new URL("../src/my-health/views/SignInMethods.tsx", import.meta.url), "utf8");
  assert.ok(!/text-danger|alert\(|confirm\(/.test(view.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n").replace(/void confirm\(e\)|async function confirm\(e: Event\)/g, "")));
  const passwordOnly = view.indexOf('if (plan.kind === "password") return setStep({ at: "password", email: plan.email });');
  const asked = view.indexOf("const check = listFromPlan(deps.plan());");
  const field = view.indexOf('setStep({ at: "email" });');
  assert.ok(passwordOnly > -1 && asked > passwordOnly && field > asked);
  assert.ok(view.slice(asked, field).includes('if (check === "listed") return setLine(EMAIL_KEPT_BY_LIST);'));
  assert.ok(view.slice(asked, field).includes('if (check === "unknown") return setLine(EMAIL_NOT_CHECKED);'));
  // every size on it is one the Profile card or the page's own form already uses
  const page = readFileSync(new URL("../src/pages/my-health.astro", import.meta.url), "utf8") + readFileSync(new URL("../src/my-health/views/Settings.tsx", import.meta.url), "utf8");
  for (const size of new Set(view.match(/text-\[[0-9.]+px\]|text-sm\b/g) ?? [])) assert.ok(page.includes(size), `${size} is not a size this card already uses`);
});
