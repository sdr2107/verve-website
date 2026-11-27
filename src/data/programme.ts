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
  "Kline 1987": { cite: "Kline and others, Medicine and Science in Sports and Exercise 1987;19(3):253-9 (PubMed 3600239)", doi: null, checked: "abstract" },
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
    plan: "The Guide's plan as it is today: zone 2 minutes a step a week, the harder minutes eased, strength held or raised. Fitness is tested again every twelve weeks, or in the last week of a shorter plan, by the method it started on.",
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

/** "Time" gets in the way: the Guide's plan opens on this many aerobic days, the fewest it offers (plan-rules: 3 to 5). The person can change it. */
export const FEWEST_AEROBIC_DAYS = 3;
export const AIMS = ["Climb four floors without stopping", "Run five kilometres easily", "Play a full game with friends", "Keep up with my children", "Feel strong lifting and carrying"];
/** What gets in the way, and the one thing each answer changes on the page. */
export const BARRIERS: { key: string; label: string; does: string }[] = [
  { key: "time", label: "Time", does: "The Guide's plan opens on three aerobic days, the fewest its rules allow." },
  { key: "unsure", label: "I am not sure what to do", does: "Every line of the Guide's plan names the published rule it comes from." },
  { key: "alone", label: "No one checks on me", does: "A coach is offered where the plan's writer is chosen." },
  { key: "stop_start", label: "I start, then stop", does: "A week short of its line is asked again, never added to the next." },
  { key: "travel", label: "Travel", does: "A week can be paused. It is shown, not judged, and the date moves with it." },
  { key: "none", label: "Nothing, I am consistent", does: "" },
];
/**
 * The one-tap answer when a week fell short of the plan (board 08). A note for the call and nothing more: from
 * 17 November 2026 no answer changes how a week is read. A week is set aside by a pause (board 13,
 * ../my-health/horizon/pause.ts), which is the only way one is.
 */
export const WAYS = [{ key: "time", label: "Time" }, { key: "travel", label: "Travel" }, { key: "illness", label: "Illness" }, { key: "unsure", label: "Not sure what to do" }, { key: "other", label: "Something else" }];

// ── a day to be ready for (board 14, 17 November 2026) ──

/**
 * The days the set-up suggests. A day is a reason and a date. It is not a goal: it sets the horizon's date, says which
 * goals are offered first, and may add a marker to the goal's own. It fills no field and sets no number (rule A).
 * A name the person gives the day is theirs alone (horizon_days, owner only); the Guide and a coach are given the
 * kind and the date.
 */
export type DayKey = "wedding" | "race" | "race_long" | "trek" | "match" | "work_test" | "birthday" | "trip" | "reunion" | "other";
export type DayKind = {
  key: DayKey;
  /** The chip. */ label: string;
  /** The horizon's title, the one a coach and the Guide see: "A wedding". */ title: string;
  /** After "for": "a wedding". */ forWords: string;
  /** The goals offered first, in order. Empty: all of them, none picked. One: it is picked. */
  goals: GoalKey[];
  /** Markers the day adds to the chosen goal's own. */
  adds: GoalMarker[];
  /** The one line the day adds, under the goals. */
  note: string;
  /** Not a chip of its own: reached from another day's second question. */ under?: DayKey;
};
export const DAYS: DayKind[] = [
  { key: "wedding", label: "A wedding", title: "A wedding", forWords: "a wedding", goals: [], adds: [],
    note: "No goal is picked for you. A weight number is read as a pace to the day, and the horizon offered after it is \"Hold what I have\"." },
  { key: "race", label: "A race", title: "A race", forWords: "a race", goals: ["build_fitness"], adds: [{ marker: "longest_session", mode: "reach" }],
    note: "The longest session joins the goal's markers. If you run, fitness can be kept to the timed run." },
  { key: "race_long", label: "A half or full marathon", title: "A race", forWords: "a race", goals: ["marathon"], adds: [], under: "race",
    note: "The Guide has no rules for the long runs yet, so a coach writes this plan." },
  { key: "trek", label: "A trek or a climb", title: "A trek or a climb", forWords: "a trek or a climb", goals: ["build_fitness"],
    adds: [{ marker: "longest_session", mode: "reach" }, { marker: "steps", mode: "reach" }, { marker: "chair_stands", mode: "ceiling" }],
    note: "Days on foot ask for the legs, so the longest session, steps and the five chair rises sit beside fitness." },
  { key: "match", label: "A match or a season", title: "A match or a season", forWords: "a match or a season", goals: ["build_fitness", "hold"], adds: [],
    note: "The sport's own training is not the plan's to write. The plan holds the week around it." },
  { key: "work_test", label: "A fitness test for work", title: "A fitness test", forWords: "a fitness test", goals: ["build_fitness"], adds: [],
    note: "The test names its own number, and you type it. Verve does not hold any employer's standard. Keep fitness to the walk or the run the test uses." },
  { key: "birthday", label: "A round birthday", title: "A birthday", forWords: "a birthday", goals: ["build_fitness", "hold"], adds: [],
    note: "Fitness tiers are read by age. A birthday can move you to the next row of the table, where the same METs sit in a different tier." },
  { key: "trip", label: "A trip on foot", title: "A trip", forWords: "a trip", goals: [], adds: [], note: "" },
  { key: "reunion", label: "A reunion", title: "A reunion", forWords: "a reunion", goals: [], adds: [], note: "" },
  { key: "other", label: "Something else", title: "A day of my own", forWords: "a day of your own", goals: [], adds: [], note: "" },
];
export const DAY_BY_KEY: Record<string, DayKind> = Object.fromEntries(DAYS.map((d) => [d.key, d]));
/** The chips, in order: every day that is not reached from another's second question. */
export const DAY_CHIPS: DayKind[] = DAYS.filter((d) => !d.under);
/** Under this many full weeks, a day offers only what a week can count: two fitness tests differ by 5% with nothing changed (Katch 1982; Edgett 2018). */
export const DAY_FEWEST_FULL_WEEKS = 4;
/** The markers a week can count, offered when the day is under DAY_FEWEST_FULL_WEEKS full weeks away. */
export const WEEK_COUNTED = new Set<string>(["dose", "zone2_week", "strength_week", "steps", "longest_session", "sessions_week", "vigorous_week"]);
export const DAY_SHORT_WORDS = "This day is under four full weeks away. Two fitness tests of one person differ by 5% with nothing changed, and a scale moves by more than a week's change. So the page offers only what a week can count: sessions, minutes and steps.";
/**
 * What a length of time is long enough for, beside the day: the same lines the templates carry, each with its paper.
 * `least` is the fewest full weeks at which the line is shown; under it the row says the time is short.
 */
export const LONG_ENOUGH: { key: string; label: string; least: number; line: Line; short: string }[] = [
  { key: "fitness", label: "Fitness", least: DAY_FEWEST_FULL_WEEKS, line: { text: "+1.1 METs is the average gain across trials of about twelve weeks. People differ widely on the same programme.", cites: ["Lin 2015", "Ross 2019"] }, short: "Too short to show a move. Two tests differ by 5% with nothing changed." },
  { key: "weight", label: "Weight", least: DAY_FEWEST_FULL_WEEKS, line: { text: "0.5 to 1 kg a week is the one weekly figure a guideline states. Your number is read against it.", cites: ["Madhu 2022"] }, short: "Too short to read a pace from." },
  { key: "waist", label: "Waist", least: DAY_FEWEST_FULL_WEEKS, line: { text: "About 3 cm with aerobic exercise in trials.", cites: ["Armstrong 2022"] }, short: "Too short to show a move." },
  { key: "week", label: "The week itself", least: 1, line: { text: "Sessions, minutes and steps are counted from the first full week.", cites: [] }, short: "No full week fits before the day." },
  { key: "grip", label: "Grip", least: 24, line: { text: "In 24 weeks of training grip rose by 1.3 kg, less than two readings of one person differ by. It is a number to hold.", cites: ["Tieland 2015", "Abe 2025"] }, short: "Not in this time. It is a number to hold." },
];
/** After a horizon set for a day, the next one offered. */
export const DAY_AFTER = "Your last horizon was for a day, and the day has passed. This one opens on \"Hold what I have\": floors, from where you ended. Any other goal can be chosen below.";

// ── fitness: the five tests the set-up asks about (board 16, 17 November 2026) ──

/** What can be typed into the fitness card: one of the app's own methods each (METTracker lib/types.ts CRFEntry.estimationMethod). */
export type EntryKey = "mask" | "walk6" | "walk1" | "cooper" | "run15" | "treadmill" | "watch";
export const ENTRY_METHOD: Record<EntryKey, string> = {
  mask: "cpet", walk6: "six-minute-walk", walk1: "one-mile-walk", cooper: "cooper-run", run15: "1.5-mile-run", treadmill: "treadmill-test", watch: "non-exercise-formula",
};
export const ENTRY_LABEL: Record<EntryKey, string> = {
  mask: "Mask", walk6: "Six-minute walk", walk1: "One-mile walk", cooper: "Twelve-minute run", run15: "1.5-mile run", treadmill: "Treadmill", watch: "Watch",
};
export type FitnessTest = {
  /** The door it opens (DOORS). */ door: DoorKey;
  title: string; what: string; who: string;
  /** How far off it can be: the figure, then the words under it. */ error: string; errorSub: string;
  /** The method families whose readings count as this test being on file (derive.ts methodFamily). */ families: string[];
  /** What can be typed for it, the first shown first. */ entries: EntryKey[];
  /** A report of it can be read. */ report: boolean;
  /** It is timed in the app, which asks its own health questions first. */ inApp: boolean;
};
export const FITNESS_TESTS: FitnessTest[] = [
  { door: "lab", title: "A test with a mask", what: "Done at a clinic or a lab. It measures the gas you breathe.", who: "Anyone who has had one. The reference the others are judged against.",
    error: "the reference", errorSub: "Two tests still differ by about 5%.", families: ["lab"], entries: ["mask"], report: true, inApp: false },
  { door: "walk", title: "A walk test", what: "Six minutes on a flat stretch, or one mile with your heart rate at the end.", who: "Anyone. The only field test for someone who does not run.",
    error: "about 1 MET", errorSub: "either way, for the six-minute walk.", families: ["walk", "one-mile-walk"], entries: ["walk6", "walk1"], report: false, inApp: true },
  { door: "run", title: "A timed run", what: "Twelve minutes, or a mile and a half, as hard as you can.", who: "Someone who already runs. The app asks its health questions before it times one.",
    error: "about 1 MET", errorSub: "either way, for the 1.5-mile run.", families: ["run"], entries: ["cooper", "run15"], report: false, inApp: true },
  { door: "treadmill", title: "A treadmill test", what: "Done elsewhere, with no mask. Often part of a health check.", who: "Anyone who has the report.",
    error: "can read 2.3 METs high", errorSub: "from the time alone.", families: ["treadmill"], entries: ["treadmill"], report: true, inApp: false },
  { door: "watch", title: "Your watch's estimate", what: "No test to do. Always shown with the word \"estimate\".", who: "Anyone whose device makes one. If it does not send it, the figure can be typed from the device's own app.",
    error: "13% off on average", errorSub: "up to 2.8 METs either way for one person.", families: ["watch"], entries: ["watch"], report: false, inApp: false },
];
/** Rule 4 (board 16): the test a horizon starts on has to be one the person can do again. */
export const AGAIN_RULE: Line = { text: "One you can do again. A clinic's test at the start needs the clinic again on the date. Where that will not happen, a walk or a run taken this week is a start you can repeat.", cites: [] };
/** The one-mile walk beside the six-minute walk: its own error, and why the two are not swapped mid-horizon. */
export const ONE_MILE_NOTE: Line = { text: "The one-mile walk tracked a treadmill test closely in the group it was checked on, with an error of 0.355 litres of oxygen a minute. A horizon that starts on a six-minute walk ends on a six-minute walk, not on the mile.", cites: ["Kline 1987"] };
/** A watch's estimate that was typed, not sent. */
export const WATCH_TYPED = "Typed from your device's own app. It is the device's estimate, not a test, and is shown with that word.";
