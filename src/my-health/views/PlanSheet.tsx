/**
 * The Plan sheet (canvas "What brings people back", board 07): the Account
 * group's Plan row opens it. What Pro adds on the website, and the price
 * area, which prints exactly what the Plans page prints: "Price to be set"
 * and no way to pay while the price in data/plans is null; the two prices
 * and the two tills (a card or a wallet through Stripe, UPI or an Indian
 * card through Razorpay) the day it is filled in, with no change here.
 *
 * One Pro, two tills: the Guide's reads and Horizon already honour the
 * app's Pro on the same sign-in (the functions ask the app's store), so a
 * person who is Pro in the app has nothing to buy. No countdown, no
 * ribbon, no crossed-out price, no waitlist.
 */
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../../lib/supabase.ts";
import { PLANS_OPEN, YEARLY_MONTHS_FREE, PRO_ON_THE_WEB, planOf, priceText, isPriced, tillsOf, type Currency, type Period, type Till } from "../../data/plans.ts";

const shown = signal(false);
export type PlanSheetHandle = { open: () => void; close: () => void };
export function mountPlanSheet(root: HTMLElement): PlanSheetHandle {
  render(<PlanSheet />, root);
  return { open: () => { shown.value = true; }, close: () => { shown.value = false; } };
}

/** A visitor outside India sees dollars first, as on the Plans page. */
const homeCurrency = (): Currency => { try { return /Kolkata|Calcutta/.test(Intl.DateTimeFormat().resolvedOptions().timeZone) ? "inr" : "usd"; } catch { return "usd"; } };

function PlanSheet() {
  const open = shown.value;
  const pro = planOf("pro");
  const priced = isPriced(pro);
  const [period, setPeriod] = useState<Period>("yearly");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") shown.value = false; };
    document.addEventListener("keydown", esc);
    (document.getElementById("plansheetclose") as HTMLElement | null)?.focus();
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  if (!open) return null;

  // the box shows the price in the visitor's own currency when it is set, else in the one that is
  const cur: Currency = pro.monthly[homeCurrency()] != null ? homeCurrency() : pro.monthly.usd != null ? "usd" : "inr";
  const tills = tillsOf(pro, period);

  async function pay(till: Till) {
    if (!till.price) return;
    if (!PLANS_OPEN) { setMsg("Plans open soon."); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setMsg("Sign in first; a plan is tied to your account."); return; }
    setBusy(till.key); setMsg("One moment…");
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ plan: "pro", period, currency: till.currency }),
      });
      const out = await resp.json().catch(() => ({}));
      if (resp.ok && out.url) { location.href = out.url; return; }
      setMsg(out.error === "billing_not_open" ? "Plans are not open for payment yet." : `Could not start checkout${out.detail ? `: ${out.detail}` : ""}.`);
    } catch { setMsg("Could not reach checkout. Try again in a moment."); }
    setBusy("");
  }

  const box = (p: Period, per: string, sub: string) => (
    <button type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}
      class={`flex flex-1 flex-col items-start gap-1 rounded-[10px] border px-4 py-3 text-left ${period === p ? "border-accent-border bg-accent-fill" : "border-border bg-alt hover:border-border-strong"}`}>
      <span class="flex items-baseline gap-2"><span class="t-figure text-text">{priceText(pro, p, cur)}</span><span class="text-[13px] text-text-2">{per}</span></span>
      <span class="text-[12px] text-text-3">{sub}</span>
    </button>
  );

  return (
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) shown.value = false; }}>
      <section role="dialog" aria-modal="true" aria-labelledby="plansheettitle" class="flex max-h-[92vh] w-full max-w-[560px] flex-col gap-[18px] overflow-y-auto rounded-t-[16px] border border-accent-border bg-card px-6 py-6 sm:rounded-[16px] sm:px-7">
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-2">
            <span class="font-mono text-[11px] font-medium text-accent-text">Pro</span>
            <h2 id="plansheettitle" class="m-0 text-[22px] font-semibold tracking-[-0.01em] text-text">Pro on the website</h2>
          </div>
          <button type="button" id="plansheetclose" onClick={() => { shown.value = false; }} aria-label="Close" class="-mr-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-[20px] leading-none text-text-3 hover:text-text">×</button>
        </div>
        <p class="m-0 text-[15px] leading-relaxed text-text-2">The Guide every week, the month and the year too; Horizon with its Monday check-ins and the month read. Nothing free is taken away.</p>
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          {PRO_ON_THE_WEB.map((row) => <li class="text-[15px] leading-relaxed text-text-2" key={row.lead}><span class="font-semibold text-text">{row.lead}</span> {row.rest}</li>)}
        </ul>

        {priced ? (
          <>
            <div class="flex flex-col gap-3 sm:flex-row">
              {box("monthly", "a month", "Cancel any time")}
              {box("yearly", "a year", `${(YEARLY_MONTHS_FREE as number) === 1 ? "One month" : `${YEARLY_MONTHS_FREE} months`} free`)}
            </div>
            <div class="flex flex-col gap-2">
              {tills.map((t, i) => (
                <button type="button" key={t.key} disabled={!t.price || busy !== ""} onClick={() => void pay(t)}
                  class={`flex min-h-12 items-center justify-center gap-2 rounded-full border px-5 text-[14px] font-semibold disabled:opacity-50 ${i === 0 ? "border-accent bg-accent text-canvas" : "border-border-strong bg-card text-text hover:border-accent-border"}`}>
                  <span>{t.label}</span><span class="font-mono text-[13px] font-medium">{t.price ?? "price to be set"}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div class="flex flex-col gap-2 rounded-[10px] border border-border bg-alt px-4 py-3">
            <span class="font-mono text-[15px] font-semibold text-text">Price to be set</span>
            <span class="text-[13px] leading-relaxed text-text-2">Pro on the website cannot be bought yet. Pro in the app already opens all of this here, on the same sign-in.</span>
          </div>
        )}
        {msg && <p class="m-0 text-[13px] text-text-2" role="status">{msg}</p>}
        <p class="m-0 text-[13px] leading-relaxed text-text-3">Already Pro in the app? Nothing to do: it is the same Pro.</p>
        <div><a href="/plans" class="text-[13px] font-semibold text-accent-text">See every plan</a></div>
      </section>
    </div>
  );
}
