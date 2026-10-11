/**
 * The Overview's glance and its four sections, as views of the document
 * (step 3). Three mounts: the line under the greeting, the four cards,
 * and one section with its tiles and the open marker. Each reads the
 * signals in ../state and the derived person; a fresh document or a tap
 * re-renders only the nodes whose values changed, and the entrance
 * animation plays once per session (../motion).
 *
 * What Verve reads, the charts and the sessions list are still HTML
 * strings from the derive layer, set as innerHTML: the words and the
 * drawings are the same as before, only the frame around them diffs.
 */
import { render } from "preact";
import { useState } from "preact/hooks";
import { derived, person, ovSection, openMarkerKey, openRange, openYear, focusTile, setSection } from "../state.ts";
import { riseOnce } from "../motion.ts";
import { addDays, daysBetween, dayWord, esc, fmt1, fmtSleepMin, mondayOf, plural, round0, todayStr } from "../derive/format.ts";
import { bodyDueFrom, labRowsFrom, methodLabel, type Due } from "../derive/markers.ts";
import { activitySummary, actsByDay, fitnessSummary } from "../derive/activity.ts";
import { sleepHeartSummary } from "../derive/heart.ts";
import { labsJudged } from "../derive/labs.ts";
import { SEC_META, SEC_ORDER, RANGE_LABEL, SHELVES, alongsideHtml, chartSvg, drawnFor, workoutsListHtml, type Marker, type Rng, type SecKey } from "../derive/lenses.ts";

// ── the glance: one number, two words of context and one sentence a section ──

type Glance = { sec: SecKey; value: string; beside: string; line: string };

/** The four cards and the line under the greeting, from the derived person. */
function glanceOf(d: NonNullable<typeof derived.value>, self: boolean): { cards: Glance[]; line: string } {
  const today = todayStr(), thisMonday = mondayOf(new Date());
  const you = self ? "your" : "their";
  const heart = sleepHeartSummary(d.signals, today);
  const goal = d.goal;
  const act = d.weeks.length || d.acts.length ? activitySummary(d.weeks, d.acts, goal, today, thisMonday) : null;
  const fit = fitnessSummary(d.crf, today);
  const by = d.by;
  const dues = [...labRowsFrom(by, today).map((r) => r.due), fit.due, bodyDueFrom(by, today)]
    .filter((x): x is Due => !!x).sort((x, y) => x.days - y.days);
  const { outside, judged } = labsJudged(d.labs);
  const cards: Glance[] = [];
  // fitness: the latest test, in METs, and when the next is due
  { const l = fit.latest;
    const mets = l ? (l.met_capacity != null ? Number(l.met_capacity) : l.v / 3.5) : null;
    const ago = l ? daysBetween(l.measured_on, today) : 0;
    const dueLine = fit.due ? (fit.due.days < 0 ? ` A retest is ${plural(-fit.due.days, "day")} overdue.` : fit.due.days === 0 ? " A retest is due today." : ` Next test in ${plural(fit.due.days, "day")}.`) : "";
    cards.push({ sec: "fitness", value: mets != null ? fmt1(mets) : "—",
      beside: l ? `METs · ${esc(methodLabel(l.method))}${fit.trendWord ? ` · ${fit.trendWord}` : ""}` : "no test on file",
      line: l ? `Tested ${ago === 0 ? "today" : `${plural(ago, "day")} ago`}.${dueLine}` : "The app offers a test in six to twelve minutes." }); }
  // movement: the week against the goal, Zone 2, the sessions, the steps
  { const tw = act?.thisWeek ? Number(act.thisWeek.met_hours) : 0, n = act?.thisWeek ? Number(act.thisWeek.workouts) : 0;
    const z2 = [...actsByDay(d.acts)].filter(([x]) => x >= thisMonday).reduce((t, [, r]) => t + r.z2, 0);
    const lastRow = d.weeks.find((w) => String(w.week_start) === addDays(thisMonday, -7));
    const steps = heart?.steps.avg;
    cards.push({ sec: "movement", value: act ? fmt1(tw) : "—",
      beside: act ? `of ${fmt1(goal)} MET-hours this week${z2 ? ` · ${round0(z2)} min in Zone 2` : ""}` : "nothing from the app yet",
      line: act ? `${n === 0 ? "No workout yet this week" : plural(n, "workout")}${steps ? `, ${steps.toLocaleString()} steps a day` : ""}.${lastRow ? ` Last week ended at ${fmt1(Number(lastRow.met_hours))}.` : ""}` : "Cloud sync in the app fills this in." }); }
  // sleep and heart: last night, the resting rate, the recovery, each against the person's own usual
  { const sl = heart?.sleep.last ?? null, usual = heart?.sleep.usual ?? null, r = heart?.rhr, h = heart?.hrr;
    const beside = [sl ? "last night" : "", r?.latest != null ? `resting ${r.latest}` : "", h?.latest != null ? `recovery ${h.latest}` : ""].filter(Boolean).join(" · ");
    const sleepLine = sl ? (usual != null ? (Math.abs(sl.min - usual) < 20 ? "Sleep is about the usual." : `Sleep is ${fmtSleepMin(Math.abs(sl.min - usual))} ${sl.min < usual ? "under" : "over"} ${you} usual.`) : sl.band === "short" ? "Sleep was under seven hours." : "") : "";
    const heartLine = r?.latest != null ? (r.baseline != null ? ((r.status === "elevated" || r.status === "stronglyElevated") && r.delta ? `Resting heart rate ${Math.abs(r.delta)} above ${you} own normal${r.run > 1 ? `, ${r.run} mornings running` : ""}.` : "The heart is where it usually is.") : "A normal for the heart needs 14 mornings.") : "";
    cards.push({ sec: "heart", value: sl ? fmtSleepMin(sl.min) : r?.latest != null ? String(r.latest) : "—",
      beside: sl ? beside : r?.latest != null ? `bpm resting${h?.latest != null ? ` · recovery ${h.latest}` : ""}` : "nothing from the watch yet",
      line: [sleepLine, heartLine].filter(Boolean).join(" ") || "A watch worn to bed and a synced app fill this in." }); }
  // body: waist to height when both are known, the grip, the count, and what is due
  { const waist = (by.get("waist_cm") ?? []).slice(-1)[0] ?? null, grip = (by.get("handgrip_kg") ?? []).slice(-1)[0] ?? null;
    const height = Number(d.profile?.height_cm) || null;
    const whr = waist && height ? waist.v / height : null;
    const read = [...by.values()].filter((v) => v.length).length;
    const due = dues[0] ?? null;
    const dueText = due ? (due.days < 0 ? ` ${esc(due.what)} is ${plural(-due.days, "day")} overdue.` : due.days === 0 ? ` ${esc(due.what)} is due today.` : due.days <= 31 ? ` ${esc(due.what)} is due in ${plural(due.days, "day")}.` : "") : "";
    cards.push({ sec: "body", value: whr != null ? whr.toFixed(2) : grip ? fmt1(grip.v) : read ? String(read) : "—",
      beside: whr != null ? `waist to height${grip ? ` · grip ${fmt1(grip.v)} kg` : ""}` : grip ? "kg grip" : read ? "markers read" : "nothing read yet",
      line: `${read ? `${plural(read, "marker")} read${outside ? `, ${outside} outside ${outside === 1 ? "its" : "their"} range` : judged ? ", all in range" : ""}.` : "No marker read yet: drop a report on Reports."}${dueText}${read ? " The values themselves are on Labs." : ""}` }); }

  // the line under the greeting
  const bits: string[] = [];
  if (act?.thisWeek) { const tw = Number(act.thisWeek.met_hours); bits.push(tw >= goal ? "a week past the goal" : tw >= goal / 2 ? "halfway to the week's goal" : "a quiet week so far"); }
  if (heart?.sleep.last && heart.sleep.usual != null) { const dd = heart.sleep.last.min - heart.sleep.usual; bits.push(Math.abs(dd) < 20 ? "sleep as usual" : dd < 0 ? "sleep a little short" : "sleep a little long"); }
  if (outside) bits.push(`${plural(outside, "lab value")} outside range`);
  if (dues[0] && dues[0].days <= 31) bits.push(dues[0].days < 0 ? `${dues[0].what.toLowerCase()} overdue` : "one retest due this month");
  const line = bits.length ? `${bits[0].charAt(0).toUpperCase()}${bits[0].slice(1)}${bits.slice(1).map((x) => `, ${x}`).join("")}. The four cards say the rest.` : "";
  return { cards, line };
}

function Frame({ sec }: { sec: SecKey }) {
  return (
    <div class="flex min-h-[150px] flex-col gap-2.5 rounded-[20px] border border-white/10 bg-white/[0.03] p-5" aria-hidden="true">
      <span class="flex items-center gap-2"><span class="h-2 w-2 shrink-0 rounded-full" style={{ background: SEC_META[sec].dot }}></span><span class="text-[12px] font-bold tracking-[0.08em] text-text-secondary">{SEC_META[sec].label.toUpperCase()}</span></span>
      <span class="mt-1 h-8 w-28 animate-pulse rounded-md bg-white/[0.05]"></span>
      <span class="h-3.5 w-3/4 animate-pulse rounded bg-white/[0.04]"></span>
    </div>
  );
}

export function GlanceLine() {
  const d = derived.value;
  const text = d ? glanceOf(d, !!person.value?.self).line : "";
  return <>{text}</>;
}

export function Glance() {
  const d = derived.value;
  if (!d) return <>{SEC_ORDER.map((sec) => <Frame key={sec} sec={sec} />)}</>;
  const { cards } = glanceOf(d, !!person.value?.self);
  const rise = riseOnce("glance");
  return (
    <>
      {cards.map((c, i) => (
        <button key={c.sec} type="button" style={{ "--i": i } as any} onClick={() => setSection(c.sec)}
          class={`${rise} flex min-h-[150px] flex-col gap-2.5 rounded-[20px] border border-white/10 bg-white/[0.03] p-5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.05]`}>
          <span class="flex items-center gap-2"><span class="h-2 w-2 shrink-0 rounded-full" style={{ background: SEC_META[c.sec].dot }}></span><span class="text-[12px] font-bold tracking-[0.08em] text-text-secondary">{SEC_META[c.sec].label.toUpperCase()}</span><svg class="ml-auto shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></span>
          <span class="flex flex-wrap items-baseline gap-x-2 gap-y-1"><span class="font-mono text-[34px] font-bold leading-none" style={{ color: SEC_META[c.sec].dot }}>{c.value}</span><span class="text-[13px] text-text-secondary" dangerouslySetInnerHTML={{ __html: c.beside }} /></span>
          <span class="text-[13px] leading-relaxed text-text-secondary" dangerouslySetInnerHTML={{ __html: c.line }} />
        </button>
      ))}
    </>
  );
}

// ── one section: its markers as tiles, one of them open ──────────────────────

function Tile({ m, i, on, out, rise, dim, onTap }: { m: Marker; i: number; on: boolean; out: boolean; rise: string; dim: boolean; onTap: () => void }) {
  const pts = m.series(); const l = pts[pts.length - 1] ?? null;
  return (
    <button type="button" style={{ "--i": i } as any} aria-current={on ? "true" : "false"} onClick={onTap}
      class={`${rise}${dim ? " mh-dim" : ""} flex flex-col gap-1 rounded-2xl border p-3.5 text-left transition-colors ${on ? "border-accent/60 bg-accent/[0.08]" : l ? "border-white/8 bg-white/4 hover:border-white/16" : "border-dashed border-white/10 hover:border-white/20"}`}>
      <span class="text-[12px] text-text-secondary">{m.label}</span>
      <span class={`font-mono text-[20px] font-bold leading-none ${l ? (out ? "text-warning" : "text-text-primary") : "text-text-muted"}`}>
        {l ? (m.pointLabel ? m.pointLabel(l) : m.fmt(l.v)) : "—"}{l && m.unit ? <> <span class="text-[10px] text-text-tertiary">{m.unit}</span></> : null}
      </span>
      <span class="text-[11.5px] leading-snug text-text-tertiary">{l ? (l.d === todayStr() ? "today" : dayWord(l.d)) : "not read yet"}</span>
    </button>
  );
}

const Kicker = ({ text }: { text: string }) => <div class="font-mono text-[10px] font-semibold tracking-[0.12em] text-text-tertiary">{text}</div>;

export function Section() {
  const [dimTo, setDimTo] = useState<string | null>(null);
  const sec = ovSection.value;
  const d = derived.value;
  if (sec === "all") return null;
  const meta = SEC_META[sec];
  const ms = d ? d.markers.filter((m) => m.section === sec) : [];
  const have = ms.filter((m) => m.series().length);
  // Nothing is open until a tile is tapped, except in a short section (six
  // tiles or fewer), which opens its first marker itself: the chart sits
  // right under the grid and reads as part of it. Body, three shelves
  // deep, waits for a tap. A marker of another section is not this one's.
  const wanted = openMarkerKey.value && ms.some((m) => m.key === openMarkerKey.value) ? openMarkerKey.value : "";
  const openKey = wanted || (ms.length <= 6 && ms.length ? (have[0] ?? ms[0]).key : "");
  const open = openKey ? ms.find((m) => m.key === openKey) ?? null : null;
  const outKeys = d ? new Set(labRowsFrom(d.by, todayStr()).filter((r) => r.out).map((r) => r.key)) : new Set<string>();
  const rise = riseOnce(`tiles:${sec}`);
  const focus = focusTile.value && open;
  const tap = (m: Marker) => {
    if (focusTile.value) { openMarkerKey.value = m.key; openRange.value = ""; openYear.value = null; return; }
    // the others fade and blur, then the page redraws with this one alone and its marker right under it
    setDimTo(m.key);
    setTimeout(() => { openMarkerKey.value = m.key; openRange.value = ""; openYear.value = null; focusTile.value = true; setDimTo(null); }, 220);
  };
  const tile = (m: Marker, i: number) => <Tile key={m.key} m={m} i={i} on={m.key === openKey} out={outKeys.has(m.key)} rise={rise} dim={dimTo != null && dimTo !== m.key} onTap={() => tap(m)} />;

  return (
    <>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="font-mono text-[10px] font-semibold tracking-[0.14em] text-text-tertiary">OVERVIEW · {meta.label.toUpperCase()} · {sec === "body" ? "FROM THE APP AND THE REPORTS" : "FROM THE APP"}</div>
          <h2 class="mt-1.5 flex items-center gap-2.5 text-[24px] font-extrabold tracking-[-0.02em] text-text-primary"><span class="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.dot }}></span><span>{meta.label}</span></h2>
          <p class="mt-1.5 text-[13px] text-text-tertiary">{meta.blurb}</p>
        </div>
        <a href={meta.science} class="text-[13px] font-medium text-accent-light hover:text-text-primary">The science behind these &rarr;</a>
      </div>
      <div class="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {focus
          ? <div class="col-span-full flex flex-wrap items-center gap-3">{tile(open!, 0)}<button type="button" onClick={() => { focusTile.value = false; openMarkerKey.value = ""; }} class="min-h-9 rounded-full border border-white/14 px-3.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:border-white/30 hover:text-text-primary">All markers</button></div>
          : sec === "body"
          ? SHELVES.map(([g, name]) => { const gm = ms.filter((m) => m.group === g); if (!gm.length) return null; const read = gm.filter((m) => m.series().length).length; return (
              <>
                <div key={`shelf:${g}`} class="col-span-full mt-2 flex items-baseline gap-2 first:mt-0"><span class="font-mono text-[10px] font-semibold tracking-[0.14em] text-text-tertiary">{name.toUpperCase()} · {gm.length}</span><span class="text-[11px] text-text-muted">{read} of {gm.length} read</span></div>
                {gm.map((m) => tile(m, ms.indexOf(m)))}
              </>); })
          : ms.map(tile)}
      </div>
      <div class="mt-4">{open && d ? <OpenMarker open={open} markers={d.markers} acts={d.acts} out={outKeys.has(open.key)} /> : null}</div>
    </>
  );
}

function OpenMarker({ open, markers, acts, out }: { open: Marker; markers: Marker[]; acts: any[]; out: boolean }) {
  // the app's Over Time lenses, by the same names, drawing the same bars
  const ranges: Rng[] = open.daily ? ["week", "4w", "months", "years"] : ["6m", "1y", "all"];
  const range: Rng = openRange.value && ranges.includes(openRange.value as Rng) ? (openRange.value as Rng) : open.daily ? "week" : "1y";
  const year = openYear.value;
  const dr = drawnFor(open, range, year);
  // the years on file, newest first, for the year menu under Years and All
  const years = [...new Set(open.series().map((p) => Number(p.d.slice(0, 4))))].sort((a, b) => b - a);
  const yearMenu = (open.daily ? range === "years" : range === "all") && years.length;
  const band = open.daily && range === "week" ? (open.band?.() ?? null) : null;
  const pts = open.series();
  const reads = [...open.reads(pts), ...(open.rangeReads?.(range, year) ?? [])];
  const t = todayStr();
  const monthAgg = (from: string, to: string) => { const xs = pts.filter((p) => p.d >= from && p.d <= to).map((p) => p.v); return xs.length ? { v: open.sum ? xs.reduce((a, b) => a + b, 0) : xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length } : null; };
  const m30 = monthAgg(addDays(t, -29), t), y1 = monthAgg(addDays(t, -364), t), y2 = monthAgg(addDays(t, -729), addDays(t, -365));
  const alongside = dr && open.daily && range === "week" ? alongsideHtml(markers, open, range, dr) : "";
  // a companion marker's figure for the same range, beside this one's (activity level ↔ active energy)
  const comp = open.companion ? markers.find((m) => m.key === open.companion) ?? null : null;
  const compDr = comp ? drawnFor(comp, range, year) : null;
  const compPts = comp ? comp.series() : [];
  const compAgg = (from: string, to: string) => { const xs = compPts.filter((p) => p.d >= from && p.d <= to).map((p) => p.v); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
  const c30 = comp ? compAgg(addDays(t, -29), t) : null, c1y = comp ? compAgg(addDays(t, -364), t) : null;
  return (
    <>
      <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="text-[20px] font-extrabold tracking-[-0.02em] text-text-primary">{open.label}</h3>
            <p class="mt-0.5 text-[12.5px] text-text-tertiary">{open.sub}</p>
          </div>
          <div class="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1" role="group" aria-label="Range">
            {ranges.map((r) => <button key={r} type="button" onClick={() => { openRange.value = r; openYear.value = null; }} class={`min-h-8 rounded-lg px-3.5 text-[13px] font-semibold transition-colors ${r === range ? "bg-accent/20 text-text-primary" : "text-text-tertiary hover:text-text-primary"}`}>{RANGE_LABEL[r]}</button>)}
          </div>
          {yearMenu ? (
            <label class="flex items-center gap-2 text-[12px] text-text-tertiary">Year
              <select value={year ?? ""} onChange={(e) => { openYear.value = Number((e.target as HTMLSelectElement).value) || null; }} class="min-h-8 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[13px] font-semibold text-text-primary focus:border-accent focus:outline-none">
                <option value="">all</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select></label>
          ) : null}
        </div>
        {dr ? (
          <>
            <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div class="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                <div class="flex items-baseline gap-2.5"><span class={`font-mono text-[38px] font-bold leading-none ${out ? "text-warning" : "text-text-primary"}`}>{dr.headline}</span><span class="text-[13.5px] text-text-secondary" dangerouslySetInnerHTML={{ __html: dr.caption }} /></div>
                {comp && compDr && compDr.headline !== "—" ? (
                  <div class="flex items-baseline gap-2"><span class="font-mono text-[38px] font-bold leading-none" style={`color:${comp.color}`}>{compDr.headline}</span><span class="text-[13.5px] text-text-secondary">{range === "week" ? `kcal active ${compPts.length && compPts[compPts.length - 1].d === t ? "today" : "on the latest day"}` : "kcal active a day"}</span></div>
                ) : null}
              </div>
              <div class="flex flex-wrap gap-4 text-[12px] text-text-secondary">
                {band ? <span><span class="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm border border-success/50 bg-success/20 align-[-1px]"></span>{band.why}</span> : null}
                {range === "week" && open.goal?.() ? <span><span class="mr-1.5 inline-block h-0.5 w-3 bg-accent-light align-[3px]"></span>the week's running total, against the goal</span> : null}
              </div>
            </div>
            <div class="mt-2 overflow-x-auto"><svg viewBox="0 0 820 200" class="block h-auto w-full min-w-[560px]" role="img" aria-label={`${open.label}, ${RANGE_LABEL[range].toLowerCase()} view`} dangerouslySetInnerHTML={{ __html: chartSvg(open, range, dr) }} /></div>
          </>
        ) : <p class="mt-4 text-[13px] text-text-tertiary">Nothing read yet for {open.label.toLowerCase()}.{open.section === "heart" || open.key === "steps" ? " The app sends it on every sync once Apple Health is on." : ""}</p>}
        <div class="mt-4 grid gap-4 border-t border-white/[0.07] pt-4 lg:grid-cols-2">
          <div>
            <Kicker text="WHAT VERVE READS" />
            <div class="mt-2 flex flex-col gap-2 text-[13.5px] leading-relaxed text-text-secondary">{reads.map((r, i) => <p key={i} dangerouslySetInnerHTML={{ __html: r }} />)}</div>
            <a href={open.science} class="mt-2.5 inline-block text-[12.5px] font-semibold text-accent-light hover:text-text-primary">The science behind this &rarr;</a>
          </div>
          <div>
            {dr && open.daily && range === "week"
              ? <><Kicker text="ALONGSIDE · THE SAME DAYS" />{alongside ? <div class="mt-2" dangerouslySetInnerHTML={{ __html: alongside }} /> : <div class="mt-2"><p class="text-[12.5px] text-text-tertiary">Nothing else read on these days yet.</p></div>}</>
              : <><Kicker text="SOURCE" /><p class="mt-2 text-[13px] leading-relaxed text-text-secondary">{open.source}</p></>}
          </div>
        </div>
      </div>
      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><Kicker text={open.daily ? "LAST 30 DAYS" : "LAST YEAR"} /><div class="mt-1.5 font-mono text-[20px] font-bold text-text-primary">{open.daily ? (m30 ? open.fmt(m30.v) : "—") : (y1 ? open.fmt(y1.v) : "—")} <span class="text-[11px] font-semibold text-text-tertiary">{open.daily ? (m30 ? `${open.unit}${open.sum ? "" : " a day"}` : "") : (y1 ? `${open.unit} average` : "")}</span></div><div class="mt-0.5 text-[12px] text-text-tertiary">{open.daily ? (m30 ? `${m30.n} days read` : "nothing read") : (y1 ? `${y1.n} reading${y1.n === 1 ? "" : "s"}` : "no reading")}</div>{comp && c30 != null ? <div class="mt-1 font-mono text-[13px] font-semibold" style={`color:${comp.color}`}>{Math.round(c30)} <span class="text-[11px] text-text-tertiary">kcal active a day</span></div> : null}</div>
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><Kicker text={open.daily ? "LAST 12 MONTHS" : "THE YEAR BEFORE"} /><div class="mt-1.5 font-mono text-[20px] font-bold text-text-primary">{open.daily ? (y1 ? open.fmt(y1.v) : "—") : (y2 ? open.fmt(y2.v) : "—")} <span class="text-[11px] font-semibold text-text-tertiary">{open.daily ? (y1 ? `${open.unit}${open.sum ? " in all" : " a day"}` : "") : (y2 ? `${open.unit} average` : "")}</span></div><div class="mt-0.5 text-[12px] text-text-tertiary">{open.daily ? (y1 && y2 ? `the year before: ${open.fmt(y2.v)}` : y1 ? `${y1.n} days read` : "nothing read") : (y2 ? `${y2.n} reading${y2.n === 1 ? "" : "s"}` : "no reading")}</div>{comp && c1y != null ? <div class="mt-1 font-mono text-[13px] font-semibold" style={`color:${comp.color}`}>{Math.round(c1y)} <span class="text-[11px] text-text-tertiary">kcal active a day</span></div> : null}</div>
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><Kicker text="SOURCE" /><div class="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{open.source}</div></div>
      </div>
      {open.key === "sessions" ? <div dangerouslySetInnerHTML={{ __html: workoutsListHtml(acts, range) }} /> : null}
    </>
  );
}

/** Mount the three views into the page's containers, once. */
export function mountOverview(els: { line: HTMLElement; glance: HTMLElement; section: HTMLElement }) {
  render(<GlanceLine />, els.line);
  render(<Glance />, els.glance);
  render(<Section />, els.section);
}
