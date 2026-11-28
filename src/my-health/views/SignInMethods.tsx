/**
 * Settings › Profile › Sign-in methods: the doors this account has, and a way
 * to add one. The rules and every word are ../signInMethods.ts; the calls are
 * ../signInMethodsApi.ts. This draws one row of the Profile card, in the
 * card's own type.
 *
 * A door that is on the account says so. One that is not has "Add". There is
 * no way to take a door away. Apple and Google leave for their own page and
 * come back; what came back is handed in by the page (`linkBack`), because the
 * page is loaded afresh on the way home.
 */
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DOOR_NAME, EMAIL_KEPT_BY_LIST, EMAIL_NOT_CHECKED, MIN_PASSWORD, addedWords, doorsOf, emailPlan, listFromPlan, secondCodeWords, troubleWords,
  type Door, type LinkBack, type Trouble, type UserLike,
} from "../signInMethods.ts";
import { confirmEmailCode, emailIsNow, readAccount, resendEmailCode, sendEmailCode, setPassword, startProviderLink } from "../signInMethodsApi.ts";

/** What came back from Apple's or Google's page on this load; the page sets it once (my-health.astro boot). */
export const linkBack = signal<LinkBack | null>(null);
/** The account the block is drawn for. */
const account = signal<UserLike>(null);

export type SignInDeps = {
  supabase: SupabaseClient;
  origin: () => string;
  /** Where the account's Pro comes from, as the page knows it (views/Settings planInfoReal); null when it does not. */
  plan: () => { through: string | null } | null;
  /** The account changed: the page's own "Signed in with" line follows. */
  onChange?: (user: UserLike) => void;
};
export type SignInHandle = { show: (user: UserLike) => void };

export function mountSignInMethods(root: HTMLElement, deps: SignInDeps): SignInHandle {
  render(<Block deps={deps} />, root);
  return {
    // The page hands in the user it holds, so the row is drawn at once; the server's copy follows.
    show: (user) => {
      account.value = user;
      if (!user) return;
      void readAccount(deps.supabase).then((fresh) => { if (fresh && fresh.id === account.value?.id) { account.value = fresh; deps.onChange?.(fresh); } });
    },
  };
}

type EmailStep =
  | { at: "closed" }
  | { at: "email" }
  /** `to` is the address the code now asked for was sent to; `second` when it is the account's current address. */
  | { at: "code"; newEmail: string; to: string; second: boolean }
  | { at: "password"; email: string };

const INPUT = "w-64 max-w-full rounded-xl border border-ink/12 bg-ink/[0.04] px-3.5 py-2 text-[15px] text-text-primary placeholder:text-text-3 focus:border-accent focus:outline-none sm:text-sm";
const PRIMARY = "min-h-10 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50";
const QUIET = "text-[13px] font-semibold text-accent-text disabled:opacity-50";
const NOTE = "m-0 text-[12.5px] leading-relaxed text-text-3";

function Block({ deps }: { deps: SignInDeps }) {
  const user = account.value;
  const back = linkBack.value;
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState("");
  const [step, setStep] = useState<EmailStep>({ at: "closed" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPasswordText] = useState("");
  const [again, setAgain] = useState("");

  // Another account on this page: nothing of the last one's stays.
  useEffect(() => { setStep({ at: "closed" }); setLine(""); setEmail(""); setCode(""); setPasswordText(""); setAgain(""); }, [user?.id]);

  // Back from Apple's or Google's page. An error is said as it is. No error is not yet "added": the account says.
  useEffect(() => {
    if (!back || !user) return;
    if (back.trouble) { setLine(troubleWords(back.trouble, back.door)); linkBack.value = null; return; }
    let live = true;
    void readAccount(deps.supabase).then((fresh) => {
      if (!live) return;
      linkBack.value = null;
      if (!fresh) return setLine(troubleWords("offline", back.door));
      account.value = fresh; deps.onChange?.(fresh);
      setLine(doorsOf(fresh).find((d) => d.door === back.door)?.has ? addedWords(back.door) : troubleWords("unknown", back.door));
    });
    return () => { live = false; };
  }, [back, user?.id]);

  if (!user) return null;
  const doors = doorsOf(user);
  const plan = emailPlan(user);
  const say = (door: Door, t: Trouble) => setLine(troubleWords(t, door));
  const refresh = async () => { const fresh = await readAccount(deps.supabase); if (fresh) { account.value = fresh; deps.onChange?.(fresh); } };

  async function addProvider(door: "apple" | "google") {
    if (busy) return;
    setBusy(true); setLine("");
    let keep: Storage | null = null; try { keep = localStorage; } catch { /* private mode */ }
    const r = await startProviderLink(deps.supabase, door, deps.origin(), keep);
    // on a yes the browser is leaving for the provider's page; only a refusal is still here to be read
    if (!r.ok) { setBusy(false); say(door, r.trouble); }
  }

  function openEmail() {
    setLine(""); setCode(""); setPasswordText(""); setAgain("");
    if (plan.kind === "password") return setStep({ at: "password", email: plan.email });
    // The email itself would change: not for an account whose Pro or programme place is kept by that email.
    const check = listFromPlan(deps.plan());
    if (check === "listed") return setLine(EMAIL_KEPT_BY_LIST);
    if (check === "unknown") return setLine(EMAIL_NOT_CHECKED);
    setStep({ at: "email" });
  }

  async function sendCode(e: Event) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setLine("");
    const r = await sendEmailCode(deps.supabase, email, user?.email ?? null);
    setBusy(false);
    if (!r.ok) return say("email", r.trouble);
    setCode("");
    setStep({ at: "code", newEmail: email.trim(), to: email.trim(), second: false });
  }

  async function confirm(e: Event) {
    e.preventDefault();
    if (busy || step.at !== "code") return;
    setBusy(true); setLine("");
    const r = await confirmEmailCode(deps.supabase, step.to, code);
    setBusy(false);
    if (!r.ok) return say("email", r.trouble);
    setCode("");
    // The server took this code and wants the one it sent to the address the account has now.
    if (!r.done && !step.second && user?.email) return setStep({ ...step, to: user.email, second: true });
    if (!r.done) return say("email", "unknown");
    await refresh();
    setStep({ at: "password", email: step.newEmail });
  }

  async function sendAgain() {
    if (busy || step.at !== "code") return;
    setBusy(true); setLine("");
    const r = await resendEmailCode(deps.supabase, step.newEmail);
    setBusy(false);
    if (!r.ok) return say("email", r.trouble);
    setLine("Sent again.");
  }

  async function usedTheLink() {
    if (busy || step.at !== "code") return;
    setBusy(true); setLine("");
    const yes = await emailIsNow(deps.supabase, step.newEmail);
    setBusy(false);
    if (!yes) return setLine("Not confirmed yet. Enter the code from the email.");
    await refresh();
    setStep({ at: "password", email: step.newEmail });
  }

  async function savePassword(e: Event) {
    e.preventDefault();
    if (busy || step.at !== "password") return;
    if (password.length < MIN_PASSWORD) return setLine(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== again) return setLine("The two passwords are not the same.");
    setBusy(true); setLine("");
    const r = await setPassword(deps.supabase, password);
    setBusy(false);
    if (!r.ok) return say("email", r.trouble);
    const at = step.email;
    setStep({ at: "closed" }); setPasswordText(""); setAgain("");
    setLine(addedWords("email", at));
    await refresh();
  }

  const close = () => { setStep({ at: "closed" }); setLine(""); };

  return (
    <div class="grid gap-x-4 gap-y-1 border-t border-border py-3 sm:grid-cols-[132px_minmax(0,1fr)]" data-signin-methods>
      <div class="text-[13px] text-text-3">Sign-in methods</div>
      <div class="flex min-w-0 flex-col gap-1">
        {doors.map((d) => (
          <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1" key={d.door} data-door={d.door} data-has={d.has ? "1" : "0"}>
            <span class="min-w-0 truncate text-[15px] font-medium text-text">{DOOR_NAME[d.door]}</span>
            {d.has
              ? <span class="min-w-0 truncate text-[13px] text-text-3">Added{d.detail ? ` · ${d.detail}` : ""}</span>
              : d.door === "email"
                ? (step.at === "closed" ? <button type="button" class={QUIET} disabled={busy} onClick={openEmail}>Add</button> : null)
                : <button type="button" class={QUIET} disabled={busy} onClick={() => void addProvider(d.door as "apple" | "google")}>Add</button>}
          </div>
        ))}
        <p class={NOTE}>Add another, and either one opens this account.</p>

        {step.at === "email" ? (
          <form class="mt-2 flex flex-col gap-2" onSubmit={(e) => void sendCode(e)}>
            <p class={NOTE}>{plan.kind === "email-first" && plan.hidden
              ? "This account's email is one Apple made to hide your own. Give the address you want to sign in with. It becomes this account's email, and Verve's emails go there."
              : "Give the address you want to sign in with. It becomes this account's email, and Verve's emails go there."}</p>
            <div class="flex flex-wrap items-center gap-2">
              <input type="email" autocomplete="email" aria-label="Email" placeholder="name@example.com" class={INPUT} value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
              <button type="submit" class={PRIMARY} disabled={busy}>Send code</button>
              <button type="button" class={QUIET} disabled={busy} onClick={close}>Not now</button>
            </div>
          </form>
        ) : null}

        {step.at === "code" ? (
          <form class="mt-2 flex flex-col gap-2" onSubmit={(e) => void confirm(e)}>
            <p class={NOTE}>{step.second ? secondCodeWords(step.to) : `Enter the 6-digit code sent to ${step.to}.`}</p>
            <div class="flex flex-wrap items-center gap-2">
              <input type="text" inputmode="numeric" autocomplete="one-time-code" maxLength={6} aria-label="Code" placeholder="6-digit code" class={INPUT} value={code}
                onInput={(e) => setCode((e.target as HTMLInputElement).value.replace(/\D/g, "").slice(0, 6))} />
              <button type="submit" class={PRIMARY} disabled={busy}>Confirm</button>
              {!step.second ? <button type="button" class={QUIET} disabled={busy} onClick={() => void sendAgain()}>Send it again</button> : null}
              {!step.second ? <button type="button" class={QUIET} disabled={busy} onClick={() => void usedTheLink()}>I used the link in the email</button> : null}
            </div>
          </form>
        ) : null}

        {step.at === "password" ? (
          <form class="mt-2 flex flex-col gap-2" onSubmit={(e) => void savePassword(e)}>
            <p class={NOTE}>{`Choose a password to use with ${step.email}. At least ${MIN_PASSWORD} characters.`}</p>
            <div class="flex flex-wrap items-center gap-2">
              <input type="password" autocomplete="new-password" aria-label="Password" placeholder="Password" class={INPUT} value={password} onInput={(e) => setPasswordText((e.target as HTMLInputElement).value)} />
              <input type="password" autocomplete="new-password" aria-label="Password again" placeholder="Password again" class={INPUT} value={again} onInput={(e) => setAgain((e.target as HTMLInputElement).value)} />
              <button type="submit" class={PRIMARY} disabled={busy}>Save</button>
              <button type="button" class={QUIET} disabled={busy} onClick={close}>Not now</button>
            </div>
          </form>
        ) : null}

        {line ? <p role="status" class="m-0 mt-1 text-[12.5px] leading-relaxed text-text-2" data-signin-line>{line}</p> : null}
      </div>
    </div>
  );
}
