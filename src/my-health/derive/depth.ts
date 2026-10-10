/**
 * In depth, as a function of the person's document: the four answers, six
 * chapters with the working beside each, what changed this week, and the
 * working itself for "In Verve's words". Every figure is from the derived
 * person; the markup is HTML strings as the page drew them, so the view
 * sets them once per document and nothing else moves. Pure.
 */
import type { PersonData } from "./person.ts";
import type { PersonLite } from "../state.ts";
import { addDays, byDate, daysBack, daysBetween, dayWord, esc, fmt1, fmtDay, fmtSleepMin, kicker, localDay, medianOf, mondayOf, monthOf, monthYearOf, signed } from "./format.ts";
import { bodyDueFrom, dueTone, dueWord, eventsFrom, labRowsFrom, methodLabel, type Due } from "./markers.ts";
import { activitySummary, fitnessSummary } from "./activity.ts";
import { HRV_MIN_NIGHTS, sleepHeartSummary } from "./heart.ts";
import { scopeList } from "./scopes.ts";

export interface Depth { head: string; cards: string; chapters: string; changed: string; working: Record<string, unknown>; heartRows: any[] }

/** True when there is nothing to go deep on: no weeks, no tests, no markers, no signals. */
export function depthEmpty(d: PersonData): boolean {
  return !d.weeks.length && !d.crf.length && !d.by.size && !d.signals.length;
}
export function depthEmptyText(p: PersonLite): string {
  return p.self
    ? "Nothing to go deep on yet. Turn on Cloud Sync in the app, or drop a report or the app's export on the Reports tab, and this page fills itself."
    : p.mine ? `Nothing on file for ${p.name} yet. Drop a report or an export for them on the Reports tab.`
    : `${p.name} has not shared anything this page can read yet.`;
}

export function depthOf(d: PersonData, p: PersonLite, today = new Date().toLocaleDateString("en-CA")): Depth {
  const thisMonday = mondayOf(new Date());
  const by = d.by;
  // ── the figures every chapter draws from ──────────────────────────────
  const goal = d.goal;
  const act = activitySummary(d.weeks, d.acts, goal, today, thisMonday);
  const { weeks, recent, prior, recentAvg, change, streak, quietDays, kinds, perWeek, minutes, vig, zone2 } = act;
  const twelve = weeks.slice(-12);
  // The newest sessions the app synced, newest first: the rows the coach's
  // working carries too, so a summary can name a workout the page shows.
  const lastWorkouts = [...d.acts].filter((w) => w?.timestamp).sort(byDate("timestamp")).slice(-8).reverse();
  const fit = fitnessSummary(d.crf, today);
  const { tests, latest, prevSame, within, trendWord } = fit; const crfDue = fit.due;
  const labRows = labRowsFrom(by, today);
  const waist = by.get("waist_cm") ?? [];
  const wl = waist[waist.length - 1] ?? null;
  const height = Number(d.profile?.height_cm) || null;
  const fat = (by.get("body_fat_pct") ?? []).slice(-1)[0] ?? null, musc = (by.get("skel_musc_pct") ?? []).slice(-1)[0] ?? null;
  const method = [...d.app].reverse().find((r) => r.body_comp_method)?.body_comp_method ?? null;
  const female = String(d.profile?.sex ?? "") === "female";
  const fn: Array<{ label: string; key: string; unit: string; judge: (v: number) => [string, boolean] }> = [
    { label: "Grip strength", key: "handgrip_kg", unit: "kg", judge: (v) => [v >= (female ? 16 : 27) ? `above ${female ? 16 : 27}` : `below ${female ? 16 : 27}`, v >= (female ? 16 : 27)] },
    { label: "Chair stand, 5 rises", key: "chair_stand_seconds", unit: "s", judge: (v) => [v <= 15 ? "under 15" : "over 15", v <= 15] },
    { label: "Walk speed", key: "gait_speed_ms", unit: "m/s", judge: (v) => [v >= 0.8 ? "above 0.8" : "below 0.8", v >= 0.8] },
    { label: "Single-leg balance", key: "single_leg_balance_seconds", unit: "s", judge: (v) => [v >= 10 ? "held" : "under 10 s", v >= 10] },
  ];
  const fnRows = fn.map((f) => ({ ...f, pt: (by.get(f.key) ?? []).slice(-1)[0] ?? null })).filter((f) => f.pt);
  const fnDay = fnRows.map((f) => f.pt!.d).sort().pop() ?? "";
  const bodyDue = bodyDueFrom(by, today);
  const heart = sleepHeartSummary(d.signals, today);
  const canSeeHeart = p.self || p.mine || p.scopes.includes("heart");
  const moving = change == null ? { k: "ACTIVITY", v: recent.length ? `${fmt1(recentAvg)} MET-h` : "—", tone: "", sub: recent.length ? `a week over the last ${recent.length === 1 ? "week" : `${recent.length} weeks`}; not enough weeks before to compare` : "no weeks on file" }
    : change >= 0.05 ? { k: "MOVING", v: `${signed(change * 100, 0)}%`, tone: "success", sub: `${recent.length}-week MET-hours against the ${prior.length} before` }
    : change <= -0.05 ? { k: "DECLINING", v: `${signed(change * 100, 0)}%`, tone: "danger", sub: `${recent.length}-week MET-hours against the ${prior.length} before` }
    : { k: "STEADY", v: `${signed(change * 100, 0)}%`, tone: "", sub: `${recent.length}-week MET-hours against the ${prior.length} before` };
  const outRows = labRows.filter((r) => r.out);
  const oldest = outRows.filter((r) => r.noFollow != null).sort((x, y) => y.noFollow! - x.noFollow!)[0];
  const dues: Due[] = [...labRows.map((r) => r.due).filter((d): d is Due => !!d), ...(crfDue ? [crfDue] : []), ...(bodyDue ? [bodyDue] : [])].sort((x, y) => x.days - y.days);
  const nextDue = dues[0] ?? null;
  const who = p.self ? "you" : (p.name || "they");
  const their = p.self ? "your" : "their";
  const MONO = "JetBrains Mono, ui-monospace, monospace";

  // ── the head, and the four answers as one strip, not four boxes ───────
  const head = `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <div class="font-mono text-[10px] font-semibold tracking-[0.14em] text-accent-light">${p.self ? "YOU" : esc((p.name || "UNNAMED").toUpperCase())} · ${p.self ? "YOUR OWN PAGE" : p.mine ? "YOU LOOK AFTER" : `SHARES ${esc(scopeList(p.scopes).toUpperCase() || "NOTHING YET")}`} · READ ${esc(fmtDay(today).toUpperCase())}</div>
        <h2 class="mt-2 text-[26px] font-extrabold leading-[1.05] tracking-[-0.03em] text-text-primary sm:text-[30px]">In depth</h2>
        <p class="mt-2 text-[13px] leading-relaxed text-text-tertiary">The four questions a coach asks of one person, then the working behind each. Every number is from ${p.self ? "your own rows" : p.mine ? `what is on file for ${esc(p.name)}` : `what ${esc(p.name)} chose to share`}.</p>
      </div>
    </div>`;
  const cell = (k: string, v: string, sub: string, tone = "", last = false) => `<div class="flex flex-col gap-1 py-4 ${last ? "" : "sm:border-r sm:border-white/[0.08] sm:pr-4"} ${k === "MOVING" || k === "ACTIVITY" || k === "STEADY" || k === "DECLINING" ? "" : "sm:pl-4"}">${kicker(k, tone === "success" ? "text-success-light" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-text-tertiary")}<div class="text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-text-primary">${v}</div><div class="text-[12.5px] leading-snug text-text-tertiary">${sub}</div></div>`;
  const cards = [
    cell(moving.k, moving.v, moving.sub, moving.tone),
    cell("FITNESS", latest ? `${fmt1(latest.v)} <span class="text-[13px] font-semibold ${trendWord === "rising" ? "text-success-light" : trendWord === "falling" ? "text-danger" : "text-text-tertiary"}">${trendWord}</span>` : "—", latest ? `VO₂max by ${esc(methodLabel(latest.method))}${within != null ? `, ${within >= 0 ? "up" : "down"} ${fmt1(Math.abs(within))} within the method` : ", first of its method"}` : "no fitness test on file"),
    cell("LABS", labRows.length ? `${outRows.length} <span class="text-[13px] font-semibold ${outRows.length ? "text-warning" : "text-success-light"}">${outRows.length ? "outside range" : "all in range"}</span>` : "—", labRows.length ? (outRows.length ? `${esc(outRows.slice(0, 2).map((r) => r.label).join(" and "))}${outRows.length > 2 ? ` and ${outRows.length - 2} more` : ""}${oldest ? `, no follow-up in ${oldest.noFollow} months` : ""}` : `${labRows.length} marker${labRows.length === 1 ? "" : "s"} on file, latest ${esc(fmtDay(labRows[0].d))}`) : "no lab values on file", outRows.length ? "warning" : ""),
    cell("DUE", nextDue ? esc(nextDue.what) : "Nothing due", nextDue ? `${esc(nextDue.why)} · ${dueWord(nextDue)}` : "in the cited cadences", nextDue && nextDue.days < 0 ? "danger" : nextDue && nextDue.days <= 30 ? "warning" : "", true),
  ].join("");

  // ── 1 · training rhythm: twelve weeks, one dot a day ─────────────────
  // The hardest session of each day colours its dot; strength is a square,
  // since it is graded by its own rule. Rest is the quiet grey. The shape
  // is the point: a coach reads the gaps as readily as the sessions.
  const isStrength = (a: any) => /strength|weight/i.test(String(a?.activity_name ?? "") + " " + String(a?.activity_type ?? ""));
  const dayKind = new Map<string, { kind: string; strength: boolean }>();
  for (const a of d.acts) {
    if (!a?.timestamp) continue;
    const d = localDay(a.timestamp), cur = dayKind.get(d) ?? { kind: "", strength: false };
    const rank = (k: string) => k === "vigorous" ? 3 : k === "moderate" ? 2 : k ? 1 : 0;
    const k = String(a.intensity_category ?? "light");
    if (rank(k) > rank(cur.kind)) cur.kind = k;
    if (isStrength(a)) cur.strength = true;
    dayKind.set(d, cur);
  }
  const gridStart = addDays(thisMonday, -77);   // twelve weeks, this one last
  let longestGap = 0, prevDay = "";
  for (let d = gridStart; d <= today; d = addDays(d, 1)) {
    if (dayKind.has(d)) { if (prevDay) longestGap = Math.max(longestGap, daysBetween(prevDay, d) - 1); prevDay = d; }
  }
  if (prevDay) longestGap = Math.max(longestGap, daysBetween(prevDay, today));
  const sessionDays = [...dayKind.keys()].filter((d) => d >= gridStart).length;
  const rhythmWords = !d.acts.length ? "The weeks, without their days"
    : perWeek >= 4 && longestGap <= 2 ? `${Math.round(perWeek)} a week, never ${longestGap + 1} days off`
    : perWeek >= 3 ? `${Math.round(perWeek)} a week, with a ${longestGap}-day gap`
    : perWeek >= 1 ? `${Math.round(perWeek)} a week, and quiet stretches` : "Quiet, lately";
  const dotColor: Record<string, string> = { vigorous: "#f87171", moderate: "#f97316", light: "#34d399" };
  let rsvg = `<g fill="#94a3b8" font-size="10" font-family="${MONO}">${["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((w, r) => `<text x="0" y="${30 + r * 26}">${w}</text>`).join("")}</g>`;
  let lastMonth = "";
  for (let c = 0; c < 12; c++) {
    const wk = addDays(gridStart, c * 7), cx = 70 + c * 60;
    const mo = wk.slice(0, 7);
    if (mo !== lastMonth) { lastMonth = mo; rsvg += `<text x="${cx}" y="10" text-anchor="middle" fill="#64748b" font-size="10" font-family="${MONO}">${monthOf(wk).toUpperCase()}</text>`; }
    for (let r = 0; r < 7; r++) {
      const d = addDays(wk, r), cy = 26 + r * 26;
      if (d > today) continue;
      const k = dayKind.get(d);
      const title = `<title>${esc(fmtDay(d))}${k ? `: ${k.kind}${k.strength ? ", strength" : ""}` : ": rest"}</title>`;
      if (!k) rsvg += `<circle cx="${cx}" cy="${cy}" r="6" fill="rgba(255,255,255,0.1)">${title}</circle>`;
      else if (k.strength && !k.kind) rsvg += `<rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" rx="2" fill="#818cf8">${title}</rect>`;
      else { rsvg += `<circle cx="${cx}" cy="${cy}" r="6" fill="${dotColor[k.kind] ?? "#34d399"}">${title}</circle>`; if (k.strength) rsvg += `<rect x="${cx + 4}" y="${cy - 10}" width="7" height="7" rx="1.5" fill="#818cf8"/>`; }
    }
  }
  const chapter = (n: number, title: string, heading: string, body: string, lines: string[], right: string) => `
    <section class="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-7">
      <div class="flex flex-col gap-2.5">
        ${kicker(`${n} · ${title}`)}
        <h3 class="text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-text-primary">${heading}</h3>
        <p class="text-[13.5px] leading-relaxed text-text-secondary">${body}</p>
        ${lines.length ? `<div class="flex flex-col gap-1 text-[13px] text-text-secondary">${lines.map((l) => `<div>${l}</div>`).join("")}</div>` : ""}
      </div>
      <div class="min-w-0">${right}</div>
    </section>`;
  const panel = (inner: string) => `<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">${inner}</div>`;
  const legend = (items: Array<[string, string, boolean?]>) => `<div class="flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-text-secondary">${items.map(([c, l, sq]) => `<span><span class="mr-1.5 inline-block h-[9px] w-[9px] ${sq ? "rounded-[2px]" : "rounded-full"} align-[-1px]" style="background: ${c}"></span>${l}</span>`).join("")}</div>`;
  const ch1 = chapter(1, "TRAINING RHYTHM", esc(rhythmWords),
    d.acts.length ? `Twelve weeks, every day a dot, coloured by the day's hardest session. The gaps are as telling as the sessions.` : `The app's sync carries each session; an export carries weeks. The day-by-day rhythm arrives with the sync.`,
    [`<strong class="text-text-primary">${fmt1(recentAvg)} MET-hours</strong> a week, the last ${recent.length === 1 ? "week" : `${recent.length} weeks`}`,
     d.acts.length ? `<strong class="text-text-primary">${Math.round(perWeek)} session${Math.round(perWeek) === 1 ? "" : "s"}</strong> a week${[...kinds].length ? ` · ${esc([...kinds].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, n]) => `${k} ${Math.round(n / Math.max(1, recent.length))}`).join(", "))}` : ""}` : "",
     d.acts.length ? `Longest gap <strong class="text-text-primary">${longestGap} day${longestGap === 1 ? "" : "s"}</strong> · ${sessionDays} of ${daysBetween(gridStart, today) + 1} days with a session` : ""].filter(Boolean),
    d.acts.length ? panel(`<div class="flex flex-wrap items-center justify-between gap-2">${kicker("ONE DOT A DAY · THIS WEEK LAST")}${legend([["rgba(255,255,255,0.18)", "Rest"], ["#34d399", "Easy"], ["#f97316", "Moderate"], ["#f87171", "Vigorous"], ["#818cf8", "Strength", true]])}</div><div class="mt-3 overflow-x-auto"><svg viewBox="0 0 760 200" class="block h-auto w-full min-w-[440px]" role="img" aria-label="Twelve weeks as columns of seven dots, one a day, coloured by the day's hardest session">${rsvg}</svg></div>`)
    : panel(`<p class="text-[13px] leading-relaxed text-text-tertiary">${weeks.length ? `${weeks.length} week${weeks.length === 1 ? "" : "s"} on file from an export. Turn on Cloud Sync in the app for the days themselves.` : "No weeks on file."}</p>`));

  // ── 2 · load and intensity ───────────────────────────────────────────
  const maxW = Math.max(goal, ...twelve.map((w) => Number(w.met_hours)));
  const bw = 30, gap = 12, left = 24;
  const ySv = (v: number) => 120 - (v / maxW) * 100;
  let asvg = `<line x1="${left}" y1="120" x2="528" y2="120" stroke="rgba(255,255,255,0.14)"/>`;
  asvg += `<line x1="${left}" y1="${ySv(goal).toFixed(1)}" x2="528" y2="${ySv(goal).toFixed(1)}" stroke="#a5b4fc" stroke-opacity="0.7" stroke-dasharray="4 4"/><text x="528" y="${(ySv(goal) - 5).toFixed(1)}" text-anchor="end" fill="#a5b4fc" font-size="10" font-family="${MONO}">GOAL ${goal}</text>`;
  twelve.forEach((w, i) => {
    const x = left + 6 + i * (bw + gap), y = ySv(Number(w.met_hours));
    const dim = i < twelve.length - Math.min(4, recent.length) || w.week_start >= thisMonday;
    asvg += `<rect x="${x}" y="${y.toFixed(1)}" width="${bw}" height="${(120 - y).toFixed(1)}" rx="2" fill="#f97316" fill-opacity="${dim ? 0.5 : 1}"><title>Week of ${esc(fmtDay(w.week_start))}: ${fmt1(Number(w.met_hours))} MET-hours, ${w.workouts} workout${Number(w.workouts) === 1 ? "" : "s"}</title></rect>`;
  });
  let lastM = "";
  twelve.forEach((w, i) => { const mo = w.week_start.slice(0, 7); if (mo === lastM) return; lastM = mo; asvg += `<text x="${left + 6 + i * (bw + gap)}" y="134" fill="#94a3b8" font-size="10" font-family="${MONO}">${monthOf(w.week_start).toUpperCase()}</text>`; });
  const sumK = (k: string) => recent.reduce((t, w) => t + (Number(w[k]) || 0), 0);
  const easyMin = sumK("light_min"), modMin = sumK("moderate_min"), vigMin = sumK("vigorous_min"), allMin = easyMin + modMin + vigMin;
  const pct = (v: number) => allMin ? Math.round((v / allMin) * 100) : 0;
  const hm = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;
  const loadWords = change == null ? (recent.length ? "The first weeks on file" : "Nothing on file yet") : `${change >= 0.05 ? "Load rising" : change <= -0.05 ? "Load falling" : "Steady load"}, ${allMin ? (pct(vigMin) >= 35 ? "a lot of it hard" : pct(easyMin) >= 50 ? "most of it easy" : "evenly graded") : "ungraded"}`;
  const ch2 = chapter(2, "LOAD AND INTENSITY", esc(loadWords),
    `Weekly MET-hours against the goal, and how the minutes split by effort. Verve grades each session against ${their} own heart-rate reserve, not a population band.`,
    [allMin ? `Vigorous share <strong class="text-text-primary">${pct(vigMin)}%</strong> of minutes` : "",
     zone2 != null ? `Zone 2 <strong class="text-text-primary">${Math.round(zone2)} min</strong> a week, of the cited 150` : "",
     act.of ? `At goal <strong class="text-text-primary">${act.atGoal} of ${act.of}</strong> weeks${streak ? ` · ${streak} in a row` : ""}` : ""].filter(Boolean),
    twelve.length ? panel(`<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div>${kicker(`WEEKLY MET-HOURS · GOAL ${goal}`)}<svg viewBox="0 0 540 140" class="mt-2 block h-auto w-full" role="img" aria-label="Twelve weeks of MET-hours as bars, the latest four brighter, with the goal line">${asvg}</svg></div>
      <div class="flex flex-col gap-2.5 lg:border-l lg:border-white/[0.07] lg:pl-5">${kicker(`MINUTES BY EFFORT · LAST ${recent.length} WEEK${recent.length === 1 ? "" : "S"}`)}
        ${allMin ? `<div class="flex h-3.5 overflow-hidden rounded-full"><span style="width: ${pct(easyMin)}%; background: #34d399"></span><span style="width: ${pct(modMin)}%; background: #f97316"></span><span style="width: ${pct(vigMin)}%; background: #f87171"></span></div>
        <div class="flex flex-col gap-1.5 text-[12.5px] text-text-secondary">
          <div class="flex justify-between"><span><span class="mr-1.5 inline-block h-2 w-2 rounded-sm align-[-1px]" style="background: #34d399"></span>Easy</span><strong class="text-text-primary">${pct(easyMin)}% · ${hm(easyMin)}</strong></div>
          <div class="flex justify-between"><span><span class="mr-1.5 inline-block h-2 w-2 rounded-sm align-[-1px]" style="background: #f97316"></span>Moderate</span><strong class="text-text-primary">${pct(modMin)}% · ${hm(modMin)}</strong></div>
          <div class="flex justify-between"><span><span class="mr-1.5 inline-block h-2 w-2 rounded-sm align-[-1px]" style="background: #f87171"></span>Vigorous</span><strong class="text-text-primary">${pct(vigMin)}% · ${hm(vigMin)}</strong></div>
        </div>
        <p class="text-[12px] leading-relaxed text-text-muted">${pct(easyMin) >= 50 && pct(vigMin) >= 15 ? "Most of the week easy, with hard days: the shape the endurance literature keeps finding." : pct(vigMin) >= 40 ? "A large hard share. The literature keeps finding that most of a week is better spent easy." : "The split of the minutes, as the app graded each session."}</p>` : `<p class="text-[13px] text-text-tertiary">No minutes on file.</p>`}
      </div></div>`)
    : panel(`<p class="text-[13px] text-text-tertiary">No weeks on file.</p>`));

  // ── 3 · sessions ─────────────────────────────────────────────────────
  const monthAgo = addDays(today, -30);
  const longest = d.acts.filter((a) => a?.timestamp && localDay(a.timestamp) >= monthAgo).reduce((m, a) => Math.max(m, Number(a.duration_minutes) || 0), 0);
  const tone = (k: string) => k === "vigorous" ? "text-danger" : k === "moderate" ? "text-met-hero" : "text-success-light";
  /** Apple's Workout Effort Score: rated by the person on the watch or typed in the app, or Apple's own estimate. */
  const effortWord = (src: unknown) => src === "estimated" ? "(est.)" : "(rated)";
  const ch3 = chapter(3, "SESSIONS", lastWorkouts.length ? `The last ${lastWorkouts.length}, as Verve read them` : "Sessions arrive with the sync",
    `Each session as the app synced it: what it was, how long, the MET-hours it earned, the minutes in ${their} Zone 2 band that day, the effort Verve graded it, and the 1-to-10 rating where the watch asked for one or ${who} typed one.`,
    [`<a href="/science/movement/a-workout" class="font-semibold text-accent-light hover:text-text-primary">A workout, as Verve reads it &rarr;</a>`],
    lastWorkouts.length ? `<div class="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]"><table class="w-full min-w-[640px] text-[12.5px]">
      <thead><tr class="text-left font-mono text-[10px] tracking-wider text-text-tertiary"><th class="px-3 py-2.5 font-semibold">WHEN</th><th class="px-3 py-2.5 font-semibold">SESSION</th><th class="px-3 py-2.5 text-right font-semibold">MIN</th><th class="px-3 py-2.5 text-right font-semibold">MET-H</th><th class="px-3 py-2.5 text-right font-semibold">ZONE 2</th><th class="px-3 py-2.5 font-semibold">EFFORT</th><th class="px-3 py-2.5 font-semibold">RATED</th><th class="px-3 py-2.5 font-semibold">NOTE</th></tr></thead>
      <tbody class="divide-y divide-white/[0.06]">${lastWorkouts.map((w) => { const mins = Math.round(Number(w.duration_minutes) || 0), z2 = Math.round(Number(w.zone2_minutes) || 0), k = String(w.intensity_category ?? "light"), st = isStrength(w); const d = localDay(w.timestamp); return `<tr>
        <td class="px-3 py-2 font-mono text-[11px] text-text-tertiary">${d === today ? "Today" : d === addDays(today, -1) ? "Yesterday" : esc(dayWord(d))}</td>
        <td class="px-3 py-2 font-semibold text-text-primary">${esc(String(w.activity_name ?? "Workout"))}</td>
        <td class="px-3 py-2 text-right font-mono text-text-secondary">${mins}</td>
        <td class="px-3 py-2 text-right font-mono font-semibold text-text-primary">${fmt1(Number(w.met_hours) || 0)}</td>
        <td class="px-3 py-2 text-right font-mono ${z2 ? "text-success-light" : "text-text-muted"}">${z2 ? z2 : "—"}</td>
        <td class="px-3 py-2"><span class="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${st ? "text-accent-light" : tone(k)}">${st ? "strength" : esc(k)}</span></td>
        <td class="px-3 py-2 font-mono ${w.effort != null ? "text-text-secondary" : "text-text-muted"}">${w.effort != null ? `${Number(w.effort)}/10 <span class="text-[10px] text-text-tertiary">${effortWord(w.effort_source)}</span>` : "—"}</td>
        <td class="px-3 py-2 text-text-tertiary">${mins && mins === longest && !st ? "longest of the month" : st ? "counts toward the 60 min" : ""}</td></tr>`; }).join("")}</tbody></table></div>`
    : panel(`<p class="text-[13px] leading-relaxed text-text-tertiary">${p.self ? "Turn on Cloud Sync in the app and each session appears here as it was read." : "An export carries weeks, not sessions; a person with an account sends them on every sync."}</p>`));

  // ── 4 · fitness and recovery ─────────────────────────────────────────
  let fsvg = "";
  if (tests.length) {
    const vs = tests.map((t) => t.v); const lo = Math.min(...vs) - 2, hi = Math.max(...vs) + 2;
    const t0 = new Date(tests[0].measured_on + "T00:00:00").getTime(), t1 = Math.max(new Date(tests[tests.length - 1].measured_on + "T00:00:00").getTime(), t0 + 86400000);
    const xf = (d: string) => 40 + ((new Date(d + "T00:00:00").getTime() - t0) / (t1 - t0)) * 470;
    const yf = (v: number) => 120 - ((v - lo) / (hi - lo)) * 100;
    fsvg += `<line x1="24" y1="120" x2="528" y2="120" stroke="rgba(255,255,255,0.14)"/><text x="8" y="124" fill="#94a3b8" font-size="10" font-family="${MONO}">${Math.round(lo)}</text><text x="8" y="24" fill="#94a3b8" font-size="10" font-family="${MONO}">${Math.round(hi)}</text>`;
    for (const grp of [false, true]) {
      const g = tests.filter((t) => t.max === grp);
      if (g.length > 1) fsvg += `<polyline points="${g.map((t) => `${xf(t.measured_on).toFixed(1)},${yf(t.v).toFixed(1)}`).join(" ")}" fill="none" stroke="${grp ? "#a5b4fc" : "#64748b"}" stroke-width="2"${grp ? "" : ' stroke-dasharray="3 4"'}/>`;
    }
    for (const t of tests) fsvg += `<circle cx="${xf(t.measured_on).toFixed(1)}" cy="${yf(t.v).toFixed(1)}" r="${t.max ? 6 : 5}" fill="${t.max ? "#818cf8" : "#64748b"}" stroke="#0D0D1C" stroke-width="2"><title>${esc(fmtDay(t.measured_on))}: ${fmt1(t.v)} by ${esc(methodLabel(t.method))}</title></circle><text x="${xf(t.measured_on).toFixed(1)}" y="${(yf(t.v) - 11).toFixed(1)}" text-anchor="middle" fill="${t.max ? "#c7d2fe" : "#94a3b8"}" font-size="12" font-weight="700">${fmt1(t.v)}</text><text x="${xf(t.measured_on).toFixed(1)}" y="134" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="${MONO}">${monthOf(t.measured_on).toUpperCase()}</text>`;
  }
  const fitWords = !latest ? "No test yet" : trendWord === "rising" ? "Rising" : trendWord === "falling" ? "Slipping, within the method" : "Holding, not yet rising";
  const rhrLine = heart?.rhr.latest != null ? (heart.rhr.read ? `Resting rate <strong class="text-text-primary">in band ${heart.rhr.inBand} of the last ${heart.rhr.read}</strong> mornings${heart.rhr.run > 1 ? `, <span class="text-warning">${heart.rhr.run} running above it</span>` : ""}` : "") : "";
  const hrvLine = heart?.hrv.latest != null ? (heart.hrv.read ? `Night HRV <strong class="text-text-primary">in or above band ${heart.hrv.read - heart.hrv.nightsBelow} of the last ${heart.hrv.read}</strong> nights${heart.hrv.run > 1 ? `, <span class="text-warning">${heart.hrv.run} running below it</span>` : ""}` : `Night HRV <strong class="text-text-primary">${heart.hrv.latest} ms</strong>; a usual needs ${HRV_MIN_NIGHTS} nights from ${esc(heart.hrv.writer ?? "one writer")}, ${heart.hrv.priors} so far`) : "";
  const trioLine = heart?.threeTogether ? `<span class="text-warning">Night HRV low, resting rate high and recovery small, each outside its own band, for the last 3 readings of each</span>: the one pattern the Guide names` : "";
  const ch4 = chapter(4, "FITNESS", esc(fitWords),
    `Every test compared only within its method: a maximal test against the last maximal, a submaximal against its own kind, never one against the other.`,
    [latest ? `<strong class="text-text-primary">${fmt1(latest.v)} mL/kg/min</strong> by ${esc(methodLabel(latest.method))} on ${esc(fmtDay(latest.measured_on))}${within != null ? `, ${within >= 0 ? "up" : "down"} ${fmt1(Math.abs(within))} on the ${esc(methodLabel(latest.method))} of ${esc(monthYearOf(prevSame!.measured_on))}` : ", the first of its method"}` : "",
     latest?.category ? `Category <strong class="text-text-primary">${esc(String(latest.category).replace(/-/g, " "))}</strong>` : "",
     crfDue ? `Retest <strong class="${dueTone(crfDue)}">${dueWord(crfDue)}</strong>, the app's own reminder` : ""].filter(Boolean),
    panel(`${kicker("FITNESS TESTS")}${tests.length ? `<svg viewBox="0 0 540 140" class="mt-2 block h-auto w-full" role="img" aria-label="Fitness tests over time, maximal tests in colour and submaximal in grey">${fsvg}</svg><p class="mt-1.5 text-[12px] leading-relaxed text-text-muted">${tests.some((t) => !t.max) ? "Submaximal tests in grey, never compared with a maximal one." : "All tests on file are maximal."}</p>` : `<p class="mt-2 text-[13px] text-text-tertiary">No fitness test on file.</p>`}`));

  // ── 5 · sleep and heart: three readings, each against its own band ───
  // Figures first: three equal cards, the person's own band shaded under
  // a small trend with the usual dashed, and a mono caption with the
  // usual, the band and the count outside it. Then the three read
  // together, the way a coach or clinician would. No score anywhere.
  const win7 = daysBack(today, 7), win28 = daysBack(today, 28);
  /** The small trend: 28 days across, the band shaded, the usual dashed, the readings outside the band marked. */
  const miniTrend = (pts: Array<{ day: string; v: number; off: boolean; title: string }>, band: { lo: number; hi: number } | null, usual: number | null, from: string, to: string) => {
    if (!pts.length) return "";
    const vs = pts.map((q) => q.v);
    const lo = Math.min(...vs, band ? band.lo : Infinity) - 2, hi = Math.max(...vs, band ? band.hi : -Infinity) + 2;
    const t0 = new Date(from + "T00:00:00").getTime(), t1 = Math.max(new Date(to + "T00:00:00").getTime(), t0 + 86400000);
    const xf = (d: string) => 4 + ((new Date(d + "T00:00:00").getTime() - t0) / (t1 - t0)) * 282;
    const yf = (v: number) => 100 - ((v - lo) / Math.max(1, hi - lo)) * 90;
    let out = "";
    if (band) out += `<rect x="4" y="${yf(band.hi).toFixed(1)}" width="282" height="${Math.max(1, yf(band.lo) - yf(band.hi)).toFixed(1)}" fill="#818cf8" fill-opacity="0.12"/>`;
    if (usual != null) out += `<line x1="4" y1="${yf(usual).toFixed(1)}" x2="286" y2="${yf(usual).toFixed(1)}" stroke="#818cf8" stroke-opacity="0.6" stroke-dasharray="3 3"/><text x="290" y="${(yf(usual) + 3).toFixed(1)}" fill="#818cf8" font-size="9" font-family="${MONO}">usual</text>`;
    if (pts.length > 1) out += `<polyline points="${pts.map((q) => `${xf(q.day).toFixed(1)},${yf(q.v).toFixed(1)}`).join(" ")}" fill="none" stroke="#818cf8" stroke-width="1.8" stroke-linejoin="round"/>`;
    for (const q of pts) out += `<circle cx="${xf(q.day).toFixed(1)}" cy="${yf(q.v).toFixed(1)}" r="${q.off ? 3.2 : 1.8}" fill="${q.off ? "#FBBF24" : "#818cf8"}" stroke="${q.off ? "#FBBF24" : "#818cf8"}" stroke-width="1.5"><title>${q.title}</title></circle>`;
    return out;
  };
  const nothingYet = !p.account_id ? "Only for a person with a Verve account: the app sends it on every sync." : !canSeeHeart ? `${esc(p.name)} has not shared sleep and heart.` : (p.self ? "Nothing here yet. In the app, turn on Back up watch readings (Settings → Your data → Backup); the night's sleep, resting heart rate and recovery arrive on the next sync. Off, they stay on the phone." : "Nothing read yet: their app's Back up watch readings switch is off, or the watch has not written a night yet.");
  const heartCard = (label: string, figure: string | null, over: string, tone: string, trend: string, empty: string, caption: string, alt: string) => `
    <div class="flex min-h-[236px] flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      ${kicker(label)}
      <div class="text-[28px] font-extrabold leading-none ${figure != null ? tone : "text-text-muted"}">${figure ?? "—"}${figure != null ? ` <span class="text-[12px] font-medium text-text-secondary">${over}</span>` : ""}</div>
      ${trend ? `<svg viewBox="0 0 330 110" class="block h-auto w-full" role="img" aria-label="${alt}">${trend}</svg>` : `<p class="text-[12.5px] leading-relaxed text-text-tertiary">${empty}</p>`}
      <div class="mt-auto font-mono text-[10px] leading-relaxed text-text-tertiary">${caption}</div>
    </div>`;
  const avgOf = (xs: number[]) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  const count = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  // night HRV: the latest writer's last 7 nights, against that writer's own band; never another writer's
  const hv = heart?.hrv ?? null;
  const hv7 = hv ? hv.series.filter((j) => j.day > win7).map((j) => j.ms) : [];
  const hvFig = avgOf(hv7);
  const hvOff = hv?.band != null && hvFig != null && hvFig < hv.band.lo;
  const hvMethod = hv?.method === "sdnn" ? "SDNN" : hv?.method === "rmssd" ? "RMSSD" : "METHOD UNDECLARED";
  const hvCard = heartCard(
    hv?.latest != null ? `NIGHT HRV · ${esc(String(hv.writer ?? "").toUpperCase())} · ${hvMethod}` : "NIGHT HRV",
    hvFig != null ? String(hvFig) : hv?.latest != null ? String(hv.latest) : null,
    hvFig != null ? `ms · ${hv7.length}-night avg` : "ms · latest night", hvOff ? "text-warning" : "text-text-primary",
    hv ? miniTrend(hv.series.map((j) => ({ day: j.day, v: j.ms, off: j.below, title: `${esc(fmtDay(j.day))}: ${j.ms} ms${j.n != null ? ` from ${count(j.n, "sample")}` : ""}${j.q1 != null ? ` · own band before ${Math.round(j.q1)}–${Math.round(j.q3!)}` : ""}` })), hv.band, hv.usual, daysBack(today, 27), today) : "",
    hv?.absent ? "No HRV reaches Apple Health from this wearable." : hv?.latest != null ? `Nothing from ${esc(hv.writer ?? "this writer")} in the last 28 nights; the latest night is ${esc(fmtDay(hv.latestDay!))}.` : nothingYet,
    hv?.latest == null ? (hv?.absent ? "no writer in the last 30 nights" : "—") : hv.band ? `usual ${hv.usual} · band ${hv.band.lo}–${hv.band.hi} · ${count(hv.nightsBelow, "night")} below${hv.mean7 ? ` · 7-night mean ${hv.mean7.ms}${hv.mean7.status ? ` ${hv.mean7.status}` : ""}` : ""}${hv.weeks[0]?.cv != null ? ` · this week scatter ${Math.round(hv.weeks[0].cv)}%${hv.weeks[0].status ? ` ${hv.weeks[0].status === "usual" ? "your usual" : hv.weeks[0].status}` : ""}` : ""}` : `a usual needs ${HRV_MIN_NIGHTS} nights from ${esc(hv.writer ?? "one writer")} · ${hv.priors} so far`,
    "Twenty-eight nights of HRV from one writer, the person's own middle-half band shaded, the usual dashed, nights below it marked");

  // resting heart rate: the last 7 mornings, against the 30-morning median, five either side
  const rh = heart?.rhr ?? null;
  const rh7 = rh ? rh.series.filter((j) => j.day > win7).map((j) => j.bpm) : [];
  const rhFig = avgOf(rh7);
  const rhBand = rh?.baseline != null ? { lo: rh.baseline - 5, hi: rh.baseline + 5 } : null;
  const rhOff = rhBand != null && rhFig != null && rhFig > rhBand.hi;
  const rhAbove = rh ? rh.series.filter((j) => j.above).length : 0;
  const rhCard = heartCard("RESTING HEART RATE",
    rhFig != null ? String(rhFig) : rh?.latest != null ? String(rh.latest) : null,
    rhFig != null ? `bpm · ${rh7.length}-morning avg` : "bpm · latest morning", rhOff ? "text-warning" : "text-text-primary",
    rh ? miniTrend(rh.series.map((j) => ({ day: j.day, v: j.bpm, off: j.above, title: `${esc(fmtDay(j.day))}: ${j.bpm} bpm${j.b != null ? ` · median before ${Math.round(j.b)}` : ""}` })), rhBand, rh.baseline, daysBack(today, 27), today) : "",
    rh?.latest != null ? `Nothing in the last 28 mornings; the latest is ${esc(fmtDay(rh.latestDay!))}.` : nothingYet,
    rh?.latest == null ? "—" : rhBand ? `usual ${rh.baseline} · band ${rhBand.lo}–${rhBand.hi} · ${count(rhAbove, "morning")} above` : `a usual needs 14 mornings · ${rh.priors} so far`,
    "Twenty-eight mornings of resting heart rate, the person's own band shaded, the usual dashed, mornings above it marked");

  // heart rate recovery: one reading a workout, so the last 28 days, or the last 8 readings when the month is empty
  const hr = heart?.hrr ?? null;
  const hrWin = hr ? hr.judged.filter((j) => j.day > win28) : [];
  const hrPts = hrWin.length ? hrWin : (hr?.judged ?? []).slice(-8);
  const hr7 = hr ? hr.judged.filter((j) => j.day > win7).map((j) => j.bpm) : [];
  const hrFig = hr7.length ? Math.round(medianOf(hr7)!) : null;
  const hrOff = hrFig != null && (hrFig <= 12 || (hr?.band != null && hrFig < hr.band.lo));
  const hrCard = heartCard("HEART RATE RECOVERY",
    hrFig != null ? String(hrFig) : hr?.latest != null ? String(hr.latest) : null,
    hrFig != null ? `bpm · ${hr7.length === 1 ? "1 reading this week" : `7-day median of ${hr7.length}`}` : "bpm · latest workout", hrOff ? (hrFig != null && hrFig <= 12 ? "text-danger" : "text-warning") : "text-text-primary",
    hr && hrPts.length ? miniTrend(hrPts.map((j) => ({ day: j.day, v: j.bpm, off: j.low, title: `${esc(fmtDay(j.day))}: ${j.bpm} bpm in the first minute` })), hr.band, hr.median, hrWin.length ? daysBack(today, 27) : hrPts[0].day, today) : "",
    !p.account_id || !canSeeHeart ? nothingYet : "No recovery on file: the watch records one after a workout that ends above the Zone 2 floor.",
    hr?.latest == null ? "—" : hr.band ? `usual ${hr.median} · band ${hr.band.lo}–${hr.band.hi} · cited line 12` : `a usual needs 5 readings · ${hr.judged.length} so far · cited line 12`,
    "Heart rate recovery after each workout, the person's own middle-half band shaded, the usual dashed, readings under it marked");

  // the three read together: the one pattern the Guide names, and what sat around it
  const lastDays = (xs: Array<{ day: string }>) => xs.slice(-3).map((x) => x.day);
  const trioDays = heart ? [...lastDays(heart.hrv.series), ...lastDays(heart.rhr.series), ...lastDays(heart.hrr.judged)].sort() : [];
  const runOf = (xs: boolean[]) => { let n = 0; for (let i = xs.length - 1; i >= 0 && xs[i]; i--) n++; return n; };
  const hrRun = hr ? runOf(hr.judged.map((j) => j.low)) : 0;
  const offBits = heart ? [
    heart.hrv.run ? `night HRV ${count(heart.hrv.run, "night")} running below its band` : "",
    heart.rhr.run ? `resting rate ${count(heart.rhr.run, "morning")} running above its band` : "",
    hrRun ? `recovery ${count(hrRun, "reading")} running under its band` : ""].filter(Boolean) : [];
  const patternText = !heart ? "Nothing read yet."
    : heart.threeTogether ? `All three outside the usual band in the same direction, the last 3 readings of each (${esc(fmtDay(trioDays[0]))}–${esc(fmtDay(trioDays[trioDays.length - 1]))}).`
    : offBits.length ? `Not all three together: ${offBits.join("; ")}. The rest inside their bands.`
    : "Each reading inside its own band, or without a band yet. Nothing to name.";
  const vig7 = d.acts.filter((a) => a?.timestamp && localDay(a.timestamp) > win7 && String(a.intensity_category) === "vigorous" && !isStrength(a));
  const aroundBits = [
    heart?.sleep.last ? `Sleep ${fmtSleepMin(heart.sleep.last.min)} ${esc(dayWord(heart.sleep.last.day))}${heart.sleep.usual != null ? ` (usual ${fmtSleepMin(heart.sleep.usual)})` : ""}.` : "",
    heart?.steps.avg != null ? `${heart.steps.avg.toLocaleString()} steps a day over the last 7${heart.steps.prior != null ? ` (${heart.steps.prior.toLocaleString()} the week before)` : ""}.` : "",
    d.acts.length ? (vig7.length ? `${count(vig7.length, "vigorous session")} in the last 7 days, ${vig7.map((a) => Math.round(Number(a.duration_minutes) || 0)).join(" and ")} min.` : "No vigorous session in the last 7 days.") : ""].filter(Boolean);
  const col = (h: string, b: string) => `<div><b class="font-bold text-text-primary">${h}</b><br>${b}</div>`;
  const readTogether = `<div class="mt-3.5 flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    ${kicker("READ TOGETHER, FOR A COACH OR CLINICIAN")}
    <div class="grid gap-3.5 text-[12.5px] leading-[18px] text-text-secondary sm:grid-cols-2 lg:grid-cols-4">
      ${col("Pattern", patternText)}
      ${col("Around it", aroundBits.length ? aroundBits.join(" ") : "Sleep, steps and sessions arrive with the sync.")}
      ${col("What it is not", `No score, no readiness number. Each reading against ${their} own 30-night median; nothing against a population.`)}
      ${col("In Verve’s words", heart?.threeTogether ? "“Three readings agree for three nights. The readings say rest before they say train.”" : "“One reading on one night is a night. The Guide stays quiet until all three agree.”")}
    </div>
  </div>`;
  const heartRows = d.signals.filter((r) => r.day > daysBack(today, 90) && (r.resting_hr != null || r.sleep_minutes != null || r.hrr_bpm != null || r.hrv_night_ms != null));
  const heartLinks = `<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px] text-accent-light">
    <a href="/science/sleep-heart/night-hrv" class="hover:text-text-primary">→ Night HRV</a>
    <a href="/science/sleep-heart/resting-heart-rate" class="hover:text-text-primary">→ Resting heart rate</a>
    <a href="/science/sleep-heart/heart-rate-recovery" class="hover:text-text-primary">→ Heart rate recovery</a>
    ${heartRows.length ? `<button type="button" id="dp-heart-export" class="hover:text-text-primary">→ Export these ${heartRows.length} rows</button>` : ""}
  </div>`;
  const offNow = heart ? [heart.hrv.below, heart.rhr.status === "elevated" || heart.rhr.status === "stronglyElevated", heart.hrr.latest != null && heart.hrr.band != null && heart.hrr.latest < heart.hrr.band.lo].filter(Boolean).length : 0;
  const heartWords = !heart ? "Nothing read yet" : heart.threeTogether ? "All three outside their bands, 3 running" : offNow === 0 ? "Each inside its own band" : offNow === 1 ? "One reading outside its band" : `${offNow === 2 ? "Two" : "Three"} readings outside their bands`;
  const ch5 = chapter(5, "SLEEP AND HEART", esc(heartWords),
    `Three readings the app sends each morning, each against ${their} own band: the middle half of the last 30 nights for HRV and recovery, 5 either side of the 30-morning median for resting rate. Nothing against a population, and no score.`,
    [rhrLine, hrvLine, trioLine,
     heart?.hrv.otherWriters.length ? `${esc(heart.hrv.otherWriters.join(", "))} also wrote HRV in the last 30 nights; only ${esc(heart.hrv.writer ?? "the latest writer")}'s nights are read, never mixed` : ""].filter(Boolean),
    `<div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">${hvCard}${rhCard}${hrCard}</div>${readTogether}${heartLinks}`);

  // ── 6 · labs, body, and what is due ──────────────────────────────────
  const labWords = !labRows.length ? "No lab values yet" : outRows.length === 0 ? "Everything in its range" : outRows.length === 1 ? "One number to chase" : `${outRows.length} numbers to chase`;
  const ch6 = chapter(6, "LABS, BODY, AND WHAT IS DUE", esc(labWords),
    `Only the markers outside their lab's range and the dates that are due. Everything else is on Labs, with its own chart.`,
    [],
    `<div class="grid gap-3.5 sm:grid-cols-3">
      <div class="rounded-2xl border ${outRows.length ? "border-warning/40" : "border-white/10"} bg-white/[0.03] p-4">${kicker(outRows.length ? "OUTSIDE RANGE" : "LABS", outRows.length ? "text-warning" : "text-text-tertiary")}
        ${outRows.length ? `<div class="mt-2 flex flex-col gap-2">${outRows.slice(0, 3).map((r) => `<div><div class="text-[14px] font-bold text-text-primary">${esc(r.label)} <span class="font-mono text-warning">${esc(r.latest)}</span></div><div class="text-[12px] text-text-tertiary">lab's range ${esc(r.range)} · ${esc(fmtDay(r.d))}${r.noFollow != null ? ` · no follow-up in ${r.noFollow} months` : ""}</div></div>`).join("")}${outRows.length > 3 ? `<button type="button" data-goto="labs" class="text-left text-[12px] font-semibold text-accent-light hover:text-text-primary">and ${outRows.length - 3} more, in Labs &rarr;</button>` : ""}</div>`
        : `<div class="mt-2 text-[14px] font-bold text-text-primary">${labRows.length ? `${labRows.length} marker${labRows.length === 1 ? "" : "s"}, all in range` : "Nothing on file"}</div><div class="text-[12px] text-text-tertiary">${labRows.length ? `latest ${esc(fmtDay(labRows[0].d))}` : "drop a report on the Reports tab"}</div>`}
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">${kicker("BODY")}
        ${wl || fat || musc || fnRows.length ? `<div class="mt-2 flex flex-col gap-1.5 text-[12.5px] leading-relaxed text-text-secondary">
          ${wl ? `<div class="text-[14px] font-bold text-text-primary">Waist <span class="font-mono">${wl.v} cm</span>${height ? ` · <span class="font-mono">${(wl.v / height).toFixed(2)}</span> to height` : ""}</div><div class="text-[12px] text-text-tertiary">${esc(fmtDay(wl.d))}${waist.length > 1 ? ` · ${wl.v === waist[0].v ? "the same as" : `${fmt1(Math.abs(wl.v - waist[0].v))} cm ${wl.v < waist[0].v ? "less than" : "more than"}`} the first` : ""}</div>` : ""}
          ${fat || musc ? `<div>${fat ? `Body fat <strong class="text-text-primary">${fat.v}%</strong>` : ""}${fat && musc ? " · " : ""}${musc ? `muscle <strong class="text-text-primary">${musc.v}%</strong>` : ""}${method ? ` · ${esc(String(method).toUpperCase())}` : ""}</div>` : ""}
          ${fnRows.length ? `<div>${fnRows.map((f) => { const [word, ok] = f.judge(f.pt!.v); return `${esc(f.label.replace(", 5 rises", ""))} <strong class="text-text-primary">${f.pt!.v} ${f.unit}</strong> <span class="${ok ? "text-success-light" : "text-warning"}">${esc(word)}</span>`; }).join(" · ")}${fnDay ? ` <span class="text-text-tertiary">· ${esc(fmtDay(fnDay))}</span>` : ""}</div>` : ""}
        </div>` : `<div class="mt-2 text-[13px] text-text-tertiary">No waist, composition or function test on file.</div>`}
      </div>
      <div class="rounded-2xl border ${nextDue && nextDue.days < 0 ? "border-danger/40" : nextDue && nextDue.days <= 30 ? "border-warning/40" : "border-white/10"} bg-white/[0.03] p-4">${kicker("DUE", nextDue && nextDue.days < 0 ? "text-danger" : nextDue && nextDue.days <= 30 ? "text-warning" : "text-text-tertiary")}
        ${dues.length ? `<div class="mt-2 flex flex-col gap-1.5 text-[13px]">${dues.slice(0, 4).map((d) => `<div><strong class="${dueTone(d)}">${esc(d.what)}</strong> <span class="text-text-secondary">${dueWord(d)}</span><div class="text-[11.5px] text-text-tertiary">${esc(d.why)}</div></div>`).join("")}</div>` : `<div class="mt-2 text-[13px] text-text-tertiary">Nothing due in the cited cadences.</div>`}
      </div>
    </div>`);
  const chapters = ch1 + ch2 + ch3 + ch4 + ch5 + ch6;

  // ── the working, for "In Verve's words" ─────────────────────────────
  const working = {
    person: { self: p.self, ageBand: d.profile?.age ? `${Math.floor(Number(d.profile.age) / 10) * 10}s` : null, sex: d.profile?.sex ?? null, weeklyGoalMetHours: goal, scopes: p.self || p.mine ? "all" : p.scopes },
    activity: { weeksOnFile: act.weeks.length, recentWeeks: recent.length, recentAvgMetHours: fmt1(recentAvg), changeVsPrior: change == null ? null : `${Math.round(change * 100)}%`, weeksAtGoalInARow: streak, atGoalOfLast12: `${act.atGoal} of ${act.of}`, daysSinceLastWorkout: quietDays, workoutsAWeek: Math.round(perWeek), kinds: [...kinds].map(([k, n]) => `${k} ${n}`), vigorousShare: minutes ? `${Math.round((vig / minutes) * 100)}%` : null, zone2MinutesAWeek: zone2 != null ? Math.round(zone2) : null, zone2WeeklyDose: 150, lastWorkouts: lastWorkouts.map((w) => ({ on: localDay(w.timestamp), name: String(w.activity_name ?? "workout"), minutes: Math.round(Number(w.duration_minutes) || 0), metHours: fmt1(Number(w.met_hours) || 0), intensity: w.intensity_category ?? null, zone2Minutes: w.zone2_minutes != null ? Math.round(Number(w.zone2_minutes)) : null, effort: w.effort != null ? Number(w.effort) : null, effortSource: w.effort != null ? (w.effort_source ?? null) : null })) },
    fitness: latest ? { latestVo2max: fmt1(latest.v), method: methodLabel(latest.method), maximal: latest.max, changeWithinMethod: within == null ? null : fmt1(within), trend: trendWord || null, category: latest.category ?? null, testedOn: latest.measured_on, retest: crfDue ? `${dueWord(crfDue)} (${crfDue.why})` : null } : null,
    labs: labRows.map((r) => ({ marker: r.label, latest: r.latest, labsRange: r.range, sinceLast: r.since, outsideRange: r.out, measuredOn: r.d, retest: r.retest })),
    body: { waist: wl ? { cm: wl.v, on: wl.d, waistToHeight: height ? (wl.v / height).toFixed(2) : null } : null, bodyFatPct: fat?.v ?? null, muscleMassPct: musc?.v ?? null, function: fnRows.map((f) => { const [word, ok] = f.judge(f.pt!.v); return { test: f.label, value: `${f.pt!.v} ${f.unit}`, verdict: word, withinCutoff: ok }; }), nextAssessment: bodyDue ? dueWord(bodyDue) : null },
    sleepHeart: heart ? {
      restingHeartRate: heart.rhr.latest != null ? { latest: heart.rhr.latest, on: heart.rhr.latestDay, ownMedian: heart.rhr.baseline, delta: heart.rhr.delta, status: heart.rhr.status, morningsAboveBandInARow: heart.rhr.run, absoluteLevel: heart.rhr.level } : null,
      sleep: heart.sleep.last ? { lastNightMinutes: heart.sleep.last.min, usualMinutes: heart.sleep.usual, band: heart.sleep.last.band, nightsIn30: heart.sleep.nights, shortNightsIn30: heart.sleep.shortNights } : null,
      heartRateRecovery: heart.hrr.latest != null ? { latestBpm: heart.hrr.latest, on: heart.hrr.latestDay, ownMedian: heart.hrr.median, ownBand: heart.hrr.band, citedLine: 12 } : null,
      nightHrv: heart.hrv.latest != null ? { latest: heart.hrv.latest, on: heart.hrv.latestDay, samples: heart.hrv.samples, usual: heart.hrv.usual, band: heart.hrv.band, nightsInBaseline: heart.hrv.priors, writer: heart.hrv.writer, method: heart.hrv.method, otherWritersInWindow: heart.hrv.otherWriters, belowBand: heart.hrv.below, nightsBelowBand: heart.hrv.nightsBelow, nightsBelowBandInARow: heart.hrv.run, nightsRead: heart.hrv.read, threeTogether: heart.threeTogether } : heart.hrv.absent ? { latest: null, note: "No HRV reaches Apple Health from this wearable", threeTogether: false } : null,
      steps: heart.steps.avg != null ? { dailyAverageLast7: heart.steps.avg, weekBefore: heart.steps.prior } : null,
    } : null,
    thisWeek: eventsFrom(d.labs, labRows, fit, act, today).map((e) => `${e.d}: ${e.text.replace(/<[^>]+>/g, "")}`),
  };

  // ── what changed this week ─────────────────────────────────────────────
  const events = eventsFrom(d.labs, labRows, fit, act, today);
  const changed = kicker("WHAT CHANGED THIS WEEK") + (events.length
    ? events.slice(0, 4).map((e) => `<span><span class="text-text-muted">${esc(dayWord(e.d))}</span> ${e.text}</span>`).join("")
    : `<span class="text-text-tertiary">Nothing new this week.</span>`);
  return { head, cards, chapters, changed, working, heartRows };
}
