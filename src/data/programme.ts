/**
 * Horizon as a programme: the goals a horizon can start from, what studies report beside each number, the ways a
 * fitness figure can arrive and how far off each can be, and the figures a weight target is read against.
 * (Canvas "Verve, Horizon as a programme", 15 November 2026; the founder's word to build it for test accounts,
 * 16 November 2026.)
 *
 * Four rules it keeps (the founder accepted them on 16 November 2026):
 *   A. The person sets every number. A goal ticks markers and shows the evidence beside the field; it fills none in.
 *   B. Measured before asked. What the devices hold is shown and confirmed; only what cannot be read is asked.
 *   C. One method from start to end. A fitness number that starts on a walk test ends on a walk test.
 *   D. Reached is worked out by the page, never claimed.
 *
 * Every figure here names its paper. `checked` says how it was read: most were read from the paper's ABSTRACT on
 * 15 November 2026 and are to be checked against the full paper before any of this is shown outside the test list.
 * No line says what a person will reach, and none says how long anyone will live.
 *
 * Pure data; ../my-health/horizon/programme.ts does the arithmetic and tests/programme.test.mjs holds both.
 */

export type Checked = "abstract" | "paper" | "guideline";
export type Source = { cite: string; doi: string | null; checked: Checked };

/** The papers, by the short name the page prints. A null DOI is one still to be confirmed against the paper. */
export const SOURCES: Record<string, Source> = {
  "Jensen 2013": { cite: "Jensen and others, 2013 AHA/ACC/TOS guideline for the management of overweight and obesity in adults", doi: "10.1161/01.cir.0000437739.71477.ee", checked: "abstract" },
  "Madhu 2022": { cite: "Madhu and others, Endocrine Society of India position statement on obesity, 2022", doi: "10.4103/2230-8210.356236", checked: "abstract" },
  "Heymsfield 2014": { cite: "Heymsfield and others, Obesity Reviews 2014;15(4):310-21", doi: "10.1111/obr.12143", checked: "abstract" },
  "Sardeli 2018": { cite: "Sardeli and others, Nutrients 2018;10(4):423", doi: "10.3390/nu10040423", checked: "abstract" },
  "Armstrong 2022": { cite: "Armstrong and others, Obesity Reviews 2022", doi: "10.1111/obr.13446", checked: "abstract" },
  "Weinsier 1995": { cite: "Weinsier and others, American Journal of Medicine 1995", doi: "10.1016/S0002-9343(99)80394-5", checked: "abstract" },
  "Thomson 2007": { cite: "Thomson and others, Clinical Nutrition 2007;26(6):771-7", doi: "10.1016/j.clnu.2007.08.003", checked: "abstract" },
  "Zibellini 2016": { cite: "Zibellini and others, Obesity Reviews 2016;17(8):647-63", doi: "10.1111/obr.12422", checked: "abstract" },
  "Anderson 2001": { cite: "Anderson and others, American Journal of Clinical Nutrition 2001;74(5):579-84", doi: "10.1093/ajcn/74.5.579", checked: "abstract" },
  "Lin 2015": { cite: "Lin and others, Journal of the American Heart Association 2015", doi: "10.1161/JAHA.115.002014", checked: "abstract" },
  "Ross 2019": { cite: "Ross and others, British Journal of Sports Medicine 2019", doi: "10.1136/bjsports-2018-100328", checked: "abstract" },
  "Katch 1982": { cite: "Katch and others, Medicine and Science in Sports and Exercise 1982", doi: "10.1249/00005768-198201000-00004", checked: "abstract" },
  "Edgett 2018": { cite: "Edgett and others, Clinical Physiology and Functional Imaging 2018", doi: "10.1111/cpf.12459", checked: "abstract" },
  "Reimers 2018": { cite: "Reimers and others, Journal of Clinical Medicine 2018;7(12):503", doi: "10.3390/jcm7120503", checked: "abstract" },
  "Spiering 2021": { cite: "Spiering and others, Journal of Strength and Conditioning Research 2021", doi: "10.1519/JSC.0000000000003964", checked: "abstract" },
  "Hickson 1985": { cite: "Hickson and others, Journal of Applied Physiology 1985", doi: null, checked: "abstract" },
  "Coyle 1984": { cite: "Coyle and others, Journal of Applied Physiology 1984;57(6):1857-64", doi: "10.1152/jappl.1984.57.6.1857", checked: "abstract" },
  "D'Silva 2020": { cite: "D'Silva and others, Frontiers in Physiology 2020", doi: "10.3389/fphys.2020.00232", checked: "abstract" },
  "Fokkema 2020": { cite: "Fokkema and others, marathon training volume and finish time", doi: null, checked: "abstract" },
  "Toresdahl 2023": { cite: "Toresdahl and others, first-time marathon runners in training", doi: "10.1136/bjsports-2022-105670", checked: "abstract" },
  "Frandsen 2025": { cite: "Schuster Brandt Frandsen and others, British Journal of Sports Medicine 2025", doi: "10.1136/bjsports-2024-109380", checked: "abstract" },
  "Buist 2008": { cite: "Buist and others, American Journal of Sports Medicine 2008;36(1):33-9", doi: "10.1177/0363546507307505", checked: "abstract" },
  "Ross 2010": { cite: "Ross and others, BMC Pulmonary Medicine 2010;10:31", doi: "10.1186/1471-2466-10-31", checked: "abstract" },
  "Neudorfer 2025": { cite: "Neudorfer and others, Sensors 2025", doi: "10.3390/s25185649", checked: "abstract" },
  "George 1993": { cite: "George and others, Medicine and Science in Sports and Exercise 1993 (PubMed 8455458)", doi: null, checked: "abstract" },
  "Mayorga-Vega 2016": { cite: "Mayorga-Vega and others, PLoS One 2016", doi: "10.1371/journal.pone.0151671", checked: "abstract" },
  "Lambe 2025": { cite: "Lambe and others, PLoS One 2025", doi: "10.1371/journal.pone.0323741", checked: "abstract" },
  "Molina-Garcia 2022": { cite: "Molina-Garcia and others, Sports Medicine 2022 (INTERLIVE)", doi: "10.1007/s40279-021-01639-y", checked: "abstract" },
  "Pinkstaff 2011": { cite: "Pinkstaff and others, Journal of Cardiopulmonary Rehabilitation and Prevention 2011", doi: "10.1097/HCR.0b013e318211e3ed", checked: "abstract" },
  "Kokkinos 2017": { cite: "Kokkinos and others, the FRIEND treadmill equation, 2017", doi: null, checked: "abstract" },
  "Huang 2022": { cite: "Huang and others, BMC Geriatrics 2022", doi: "10.1186/s12877-022-03270-6", checked: "abstract" },
  "Jimenez-Sanchez 2024": { cite: "Jimenez-Sanchez and others, Nutrients 2024;16:1824", doi: "10.3390/nu16121824", checked: "abstract" },
  "Cruz-Jentoft 2019": { cite: "Cruz-Jentoft and others, Age and Ageing 2019;48:16-31 (EWGSOP2)", doi: "10.1093/ageing/afy169", checked: "abstract" },
  "Chen 2020": { cite: "Chen and others, Journal of the American Medical Directors Association 2020 (AWGS 2019)", doi: "10.1016/j.jamda.2019.12.012", checked: "abstract" },
  "Pal 2020": { cite: "Pal and others, European Geriatric Medicine 2020", doi: "10.1007/s41999-020-00332-z", checked: "abstract" },
  "Tieland 2015": { cite: "Tieland and others, International Journal of Sport Nutrition and Exercise Metabolism 2015;25:27-36", doi: "10.1123/ijsnem.2013-0123", checked: "abstract" },
  "Abe 2025": { cite: "Abe and others, Journal of Sports Science and Medicine 2025", doi: "10.52082/jssm.2025.543", checked: "abstract" },
  "Verdich 2011": { cite: "Verdich and others, Diabetes and Metabolism 2011;37(3):222-9", doi: "10.1016/j.diabet.2010.10.007", checked: "abstract" },
};
export const doiUrl = (name: string): string | null => (SOURCES[name]?.doi ? `https://doi.org/${SOURCES[name].doi}` : null);

/** A sentence the page prints beside a field, and the papers it rests on (keys of SOURCES). */
export type Line = { text: string; cites: string[] };

// ── the goals ──

export type GoalKey = "lose_weight" | "build_fitness" | "hold" | "marathon" | "own";
/**
 * How a goal starts a marker: "reach" a number by the date; hold "at least" a number (a floor); hold "at most" one
 * (a ceiling, for a time in seconds); stay "between" two; or "watch" it, where no number is needed.
 */
export type Mode = "reach" | "floor" | "ceiling" | "band" | "watch";
export type GoalMarker = { marker: string; mode: Mode };
export type Goal = {
  key: GoalKey; title: string; lead: string;
  /** The lengths it suits, in months, and the words for it. */
  suits: (3 | 6 | 12)[]; suitsWords: string;
  markers: GoalMarker[];
  /** What studies report, shown beside the numbers. */
  evidence: Line[];
  /** What the plan does about it. */
  plan: string;
  /** Who writes the plan when the Guide has no rules for the goal. */
  writer?: "coach";
};

export const GOALS: Goal[] = [
  {
    key: "lose_weight", title: "Lose weight", lead: "Weight and waist down, at a pace you can keep, with strength held.",
    suits: [6], suitsWords: "Suits 6 months",
    markers: [
      { marker: "weight", mode: "reach" }, { marker: "waist", mode: "reach" }, { marker: "dose", mode: "floor" },
      { marker: "strength_week", mode: "reach" }, { marker: "steps", mode: "reach" }, { marker: "grip", mode: "floor" }, { marker: "chair_stands", mode: "ceiling" },
    ],
    evidence: [
      { text: "5 to 10% of your weight within six months is the loss the US guideline describes.", cites: ["Jensen 2013"] },
      { text: "0.5 to 1 kg a week is the one weekly figure a guideline states. It is India's.", cites: ["Madhu 2022"] },
      { text: "About a quarter of weight lost is lean tissue, as a rule of thumb. Resistance training kept most of it in older adults.", cites: ["Heymsfield 2014", "Sardeli 2018"] },
      { text: "A waist fell by about 3 cm with aerobic exercise in trials.", cites: ["Armstrong 2022"] },
    ],
    plan: "Strength twice a week from the first week, before any climb. The week's minutes grow towards the 200 to 300 a week that went with keeping weight off in trials. It writes no diet.",
  },
  {
    key: "build_fitness", title: "Build fitness", lead: "Your fitness in METs up, on a week that grows one step at a time.",
    suits: [3], suitsWords: "Suits 3 months",
    markers: [
      { marker: "mets", mode: "reach" }, { marker: "zone2_week", mode: "reach" }, { marker: "dose", mode: "floor" },
      { marker: "strength_week", mode: "reach" }, { marker: "rhr", mode: "watch" },
    ],
    evidence: [
      { text: "+1.1 METs is the average gain across trials of about twelve weeks.", cites: ["Lin 2015"] },
      { text: "People differ widely on the same programme: from a fall of 5% to a rise of 51%.", cites: ["Ross 2019"] },
      { text: "Two tests of one person differ by about 5% with nothing changed. A smaller move is not a change.", cites: ["Katch 1982", "Edgett 2018"] },
      { text: "Resting heart rate fell by about 3 beats a minute with training, on average.", cites: ["Reimers 2018"] },
    ],
    plan: "The Guide's plan as it is today: zone 2 minutes a step a week, the harder minutes eased, strength held or raised. Fitness is tested in week 8 and at the end, by the method it started on.",
  },
  {
    key: "hold", title: "Hold what I have", lead: "Floors, not climbs. The least that keeps you where you are.",
    suits: [3, 12], suitsWords: "Suits 3 months or a year",
    markers: [
      { marker: "dose", mode: "floor" }, { marker: "strength_week", mode: "floor" }, { marker: "mets", mode: "floor" },
      { marker: "weight", mode: "band" }, { marker: "grip", mode: "floor" },
    ],
    evidence: [
      { text: "Endurance was held for up to 15 weeks on two sessions a week, as long as the intensity was kept.", cites: ["Spiering 2021"] },
      { text: "Strength was held for up to 32 weeks on one session a week.", cites: ["Spiering 2021"] },
      { text: "Cutting the intensity is what lost fitness, not cutting the time.", cites: ["Hickson 1985"] },
      { text: "Stopping altogether cost trained adults 7% of their fitness in 21 days.", cites: ["Coyle 1984"] },
    ],
    plan: "The same week, held. The plan shows the least that holds each floor, so a crowded month has a week it can still keep.",
  },
  {
    key: "marathon", title: "Run a marathon", lead: "A race date as the horizon's date. A base first, then the long runs.",
    suits: [12, 6], suitsWords: "Suits a year, or 6 months from a base",
    markers: [
      { marker: "longest_session", mode: "reach" }, { marker: "dose", mode: "floor" }, { marker: "zone2_week", mode: "reach" },
      { marker: "mets", mode: "reach" }, { marker: "rhr", mode: "watch" },
    ],
    evidence: [
      { text: "First-timers' plans ran 16 to 18 weeks.", cites: ["D'Silva 2020"] },
      { text: "Under 40 km a week went with a finish 6 minutes slower, and a longest run under 25 km with 13 minutes slower. Neither went with injury.", cites: ["Fokkema 2020"] },
      { text: "Four in ten were injured while training.", cites: ["Toresdahl 2023"] },
      { text: "One run more than 10% longer than your longest of the last 30 days went with 1.64 times the injuries. The \"10% a week\" rule made no difference in its own trial.", cites: ["Frandsen 2025", "Buist 2008"] },
    ],
    plan: "Three stages on one horizon: a base, a build where no run passes 10% over the longest of the last 30 days, then the 16 to 18 weeks. The Guide has no rules for this yet, so this goal is set up with a coach who writes the plan.",
    writer: "coach",
  },
];
export const GOAL_BY_KEY: Record<string, Goal> = Object.fromEntries(GOALS.map((g) => [g.key, g]));
export const OWN_GOAL = { key: "own" as const, title: "My own targets", lead: "Any of the markers on this page, as today." };
/** What each length is long enough for, beside the choice (board 04). */
export const LENGTH_FOR: Record<3 | 6 | 12, string> = {
  3: "One change you can see: a step up in fitness, a first few kilos.",
  6: "Weight at a steady pace. A habit that has to survive a bad month.",
  12: "A first marathon from a standing start. A change you mean to keep.",
};
/** What every template keeps, under the draft. */
export const TEMPLATE_KEEPS = "No field is filled in. A figure beside a field says what studies found for groups of people and names the paper. It never says what you will reach. A goal can be left at any time for your own targets, and nothing already kept is lost.";

// ── fitness, by one of four doors ──

export type DoorKey = "walk" | "run" | "watch" | "treadmill" | "lab";
export type Door = {
  key: DoorKey; title: string; lead: string;
  /** The figure the row carries for the whole horizon, in words: "about 1 MET either way". */
  error: string; errorNote: Line;
  /** The surest first: a test with a mask, a field test, a treadmill time, a watch. */
  rank: number;
};
export const DOORS: Door[] = [
  { key: "lab", title: "A test with a mask", lead: "It measures the gas you breathe, and is the reference the others are judged against.", error: "the reference", errorNote: { text: "Two tests of one person still differ by about 5% with nothing changed.", cites: ["Katch 1982", "Edgett 2018"] }, rank: 1 },
  { key: "walk", title: "A six-minute walk", lead: "How far you get on a flat, measured stretch. For anyone, and the only door for someone who cannot run.", error: "about 1 MET either way", errorNote: { text: "About 1 MET either way in the studies that made the equations. Wider in an independent check: 12.6% off on average.", cites: ["Ross 2010", "Neudorfer 2025"] }, rank: 2 },
  { key: "run", title: "A timed run", lead: "Twelve minutes, or a mile and a half. For someone who already runs.", error: "about 1 MET either way", errorNote: { text: "About 1 MET either way for the 1.5-mile run. The twelve-minute run tracks a lab test well across studies, with no single error figure.", cites: ["George 1993", "Mayorga-Vega 2016"] }, rank: 2 },
  { key: "treadmill", title: "A treadmill test", lead: "The time you lasted on a treadmill test done elsewhere, with no mask.", error: "can read 2.3 METs high", errorNote: { text: "A treadmill time alone read 2.3 METs high. The usual equations are off by 21%, a newer one by 5%.", cites: ["Pinkstaff 2011", "Kokkinos 2017"] }, rank: 3 },
  { key: "watch", title: "Your watch's estimate", lead: "No test to do. Always shown with the word \"estimate\".", error: "13% off on average", errorNote: { text: "13% off on average for one common watch. For one person it can be out by up to about 2.8 METs either way.", cites: ["Lambe 2025", "Molina-Garcia 2022"] }, rank: 4 },
];
export const DOOR_BY_KEY: Record<string, Door> = Object.fromEntries(DOORS.map((d) => [d.key, d]));
/** Rule C, and what two tests of one person differ by with nothing changed. */
export const FITNESS_RULES = {
  /** A move smaller than this share of the start is not a change (Katch 1982; Edgett 2018). */
  noChangeShare: 0.05,
  lines: [
    { text: "One door for the whole horizon. A watch's estimate at the start and a run at the end are two different rulers.", cites: [] },
    { text: "Under 5% is not a change. Two tests of one person differ by about that much with nothing changed.", cites: ["Katch 1982", "Edgett 2018"] },
    { text: "The surest door you can use. In order: a test with a mask, a field test, a treadmill time, a watch.", cites: [] },
  ] as Line[],
};

// ── strength: grip, and the chair rises beside it ──

export const GRIP = {
  /** A move smaller than this, in kg, reads as no change: two readings of one person differ by 4 to 5 kg (Abe 2025). */
  noChangeKg: 5,
  how: { text: "Three squeezes each hand, seated, elbow at a right angle, a rest between tries. The best one is kept. The same device every time.", cites: ["Huang 2022", "Jimenez-Sanchez 2024"] } as Line,
  moves: { text: "In 24 weeks of training, leg strength rose by 21 kg and grip by 1.3 kg. Two readings of one person differ by 4 to 5 kg with nothing changed. So grip is a number to hold, and to watch across years.", cites: ["Tieland 2015", "Abe 2025"] } as Line,
  notMuscle: { text: "It is not a muscle gauge. On a diet alone, leg strength fell 7.5% and grip did not move. That is why the chair rises sit beside it.", cites: ["Zibellini 2016"] } as Line,
  /** The published lines for low grip, in kg. Shown as what the papers print, never as a verdict on the person. */
  lines: [
    { name: "European consensus", men: 27, women: 16, cite: "Cruz-Jentoft 2019" },
    { name: "Asian consensus", men: 28, women: 18, cite: "Chen 2020" },
    { name: "One Indian study", men: 27.5, women: 18.0, cite: "Pal 2020" },
  ],
  /** Five chair rises, in seconds: the two consensus lines. */
  chair: { asian: 12, european: 15 },
};

// ── weight: what a number's pace is read against ──

export const WEIGHT = {
  /** The loss the US guideline describes, as a share of body weight within six months (Jensen 2013). */
  shareLow: 5, shareHigh: 10, withinWeeks: 26,
  /** The one weekly figure a guideline states, kg a week (Madhu 2022). */
  weeklyLow: 0.5, weeklyHigh: 1.0,
  /** Above this, kg a week, the risk of gallstones climbs steeply (Weinsier 1995). */
  steep: 1.5,
  /** A home scale against a scan, for one person's change in lean mass, kg either way (Thomson 2007; Verdich 2011). */
  scaleErrorKg: 4,
  cites: { share: "Jensen 2013", weekly: "Madhu 2022", steep: "Weinsier 1995", scale: ["Thomson 2007", "Verdich 2011"], waist: "Armstrong 2022", strength: "Zibellini 2016", regain: ["Anderson 2001", "Jensen 2013"] },
  /** After a weight horizon the next one offered is "Hold what I have". */
  after: { text: "Most lost weight comes back: 71 to 83% within four to five years. What went with keeping it off was 200 to 300 minutes of activity a week.", cites: ["Anderson 2001", "Jensen 2013"] } as Line,
  stops: "The page stops there. It does not say the loss is fat. No study tests strength as a sign of kept muscle.",
};

// ── the way in: the questions asked before a horizon (board 03) ──

export const AIMS = ["Climb four floors without stopping", "Run five kilometres easily", "Play a full game with friends", "Keep up with my children", "Feel strong lifting and carrying"];
/** What gets in the way, and the one thing each answer changes on the page. */
export const BARRIERS: { key: string; label: string; does: string }[] = [
  { key: "time", label: "Time", does: "The plan opens on the fewest aerobic days its rules allow." },
  { key: "unsure", label: "I am not sure what to do", does: "The plan opens on its rules, each with its source." },
  { key: "alone", label: "No one checks on me", does: "A coach is offered where the plan's writer is chosen." },
  { key: "stop_start", label: "I start, then stop", does: "A week short of its line is asked again, never added to the next." },
  { key: "travel", label: "Travel", does: "A week can be marked away. It is shown as the days it had and is not judged." },
  { key: "none", label: "Nothing, I am consistent", does: "" },
];
/** The one-tap answer when a week fell short of the plan (board 08). */
export const WAYS = [{ key: "time", label: "Time" }, { key: "travel", label: "Travel" }, { key: "illness", label: "Illness" }, { key: "unsure", label: "Not sure what to do" }, { key: "other", label: "Something else" }];
/** Travel or illness marks the week as away. */
export const AWAY_WAYS = new Set(["travel", "illness"]);
