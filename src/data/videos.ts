/**
 * Every video Verve has made, and where each one lives on the site.
 *
 * The files are the silent 16:9 website cuts made by ~/Desktop/verve-videos
 * (captions burned in, music off, no voice), one folder a video under
 * public/video/<slug>/ with its poster. Self-hosted on purpose: a YouTube
 * embed would put a third-party cookie on every science page, which the
 * privacy policy would then have to name, and its player does not match the
 * page. `youtube` is the video's own id on the channel (the wide cut where the
 * channel has one, else the Short), so the link under the title opens that
 * video, not the channel's home page. `posts` are the founder's Substack and X
 * posts on the same question (the one it was made from, where there is one),
 * for a reader who would rather read. What each
 * video says on screen is in videoWords.json, for the search. Durations are the
 * files' own, to the second.
 *
 * `topic` is the science topic page the video explains (its slug, as in
 * scienceTopics.ts); a video without one lives on /videos alone, under its
 * group. The order here is the order on the page.
 */

export type VideoGroup = "how-verve-works" | "fitness" | "movement" | "sleep-heart" | "body" | "wider-picture";

export interface Video {
  slug: string;
  title: string;
  /** Length, seconds. */
  seconds: number;
  group: VideoGroup;
  /** The science topic page it sits on, when it has one. */
  topic?: string;
  /** Its id on the YouTube channel: youtube.com/watch?v=<id>. */
  youtube?: string;
  /** The founder's posts on the same question: read rather than watch, or both. */
  posts?: { substack?: string; x?: string };
}

export const GROUPS: { key: VideoGroup; label: string; blurb: string }[] = [
  { key: "how-verve-works", label: "How Verve works", blurb: "What the app does, screen by screen." },
  { key: "fitness", label: "Fitness", blurb: "Your fitness as a number, and what the number is worth." },
  { key: "movement", label: "Movement", blurb: "How much, how hard, how often, and the rest of the day." },
  { key: "sleep-heart", label: "Sleep and heart", blurb: "What the watch reads while you sleep and in the minute after you stop." },
  { key: "body", label: "Body", blurb: "The markers, their bands, and what to repeat when." },
  { key: "wider-picture", label: "The wider picture", blurb: "The studies behind everyday health, read one at a time." },
];

export const VIDEOS: Video[] = [
  { slug: "crf-explained", title: "What is cardiorespiratory fitness?", seconds: 29, group: "fitness", topic: "crf", posts: { substack: "https://roplekarsudeep.substack.com/p/what-is-vo2max-cardiorespiratory-fitness-guide", x: "https://x.com/RoplekarSudeep/status/2085251474519708132" } },
  { slug: "crf-tiers-thread", title: "Fitness is a vital sign. Yours is probably not on file.", seconds: 49, group: "fitness", topic: "crf" },
  { slug: "2026-09-29-tier-not-score", title: "A tier, not a score", seconds: 14, group: "fitness", topic: "crf", youtube: "rN41_e4baiI", posts: { substack: "https://roplekarsudeep.substack.com/p/fitness-tiers-for-vo2max-more-reliable" } },
  { slug: "arc-crf-prescription", title: "Exercise matched to your fitness: one prescription does not fit all", seconds: 176, group: "fitness", topic: "crf", youtube: "Qhb1QzZ270c", posts: { substack: "https://roplekarsudeep.substack.com/p/how-to-know-if-your-exercise-routine", x: "https://x.com/RoplekarSudeep/status/2086682174850515317" } },
  // Off the site since 15 Nov 2026, until its opening card is recut: Arc Story 17 (slug arc-fitness-survival), the
  // fitness-and-survival video, 153 s. Its first caption carries a line this site retired (the test "no page
  // promises anything about how long a person will live"). It stays on the channels. To bring it back: the recut
  // file and poster under public/video/arc-fitness-survival/, its line here, and the test that holds it off removed.
  { slug: "one-met", title: "One MET", seconds: 14, group: "fitness", topic: "mets-vs-met-h" },
  { slug: "when-to-retest", title: "When should you retest your fitness?", seconds: 56, group: "fitness", topic: "test-crf", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-347223268", x: "https://x.com/RoplekarSudeep/status/2104260584124399745" } },
  { slug: "watch-vs-run", title: "My watch said 10.9. The run said 8.7.", seconds: 29, group: "fitness", topic: "test-accuracy", posts: { substack: "https://roplekarsudeep.substack.com/p/my-watch-said-i-have-a-crf-of-109" } },
  { slug: "2026-09-30-watch-vo2max", title: "METs first, estimates labelled", seconds: 16, group: "fitness", topic: "test-accuracy" },
  { slug: "2026-10-01-flags-not-goals", title: "No goal line, just flags", seconds: 14, group: "movement", topic: "weekly-volume" },
  { slug: "acc-exercise-1-dose", title: "Exercise, prescribed: the 2026 ACC statement (part 1, the dose)", seconds: 85, group: "movement", topic: "weekly-volume", youtube: "o3YsotwPEoc", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-363328825", x: "https://x.com/RoplekarSudeep/status/2111468943374438612" } },
  { slug: "acc-exercise-2-evidence", title: "Exercise, prescribed: the evidence and wearables (part 2)", seconds: 90, group: "movement", topic: "weekly-volume", youtube: "nF6JxkmRi_A", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-363328825", x: "https://x.com/RoplekarSudeep/status/2111468943374438612" } },
  { slug: "feature-ascent-dose", title: "Verve feature: the Ascent and the weekly dose", seconds: 166, group: "movement", topic: "weekly-volume", youtube: "WNYt5EgoRp4" },
  { slug: "2026-10-03-zone2-yours", title: "Your Zone 2 is yours", seconds: 14, group: "movement", topic: "zone-2", posts: { substack: "https://roplekarsudeep.substack.com/p/zone-2-has-been-renamed-and-the-science" } },
  { slug: "polarised-training", title: "Polarised training: what is the 80/20 rule?", seconds: 75, group: "movement", topic: "zone-2", youtube: "E14YN1nRj9Q", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-353190150", x: "https://x.com/RoplekarSudeep/status/2106981047074451878" } },
  { slug: "2026-10-04-strength-column", title: "Strength gets its own column", seconds: 14, group: "movement", topic: "strength-training" },
  { slug: "strength-how-much", title: "Strength training: how much is enough to live longer?", seconds: 72, group: "movement", topic: "strength-training", youtube: "6_-lwVcoT5Q", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-353603089", x: "https://x.com/RoplekarSudeep/status/2107161948412637545" } },
  { slug: "arc-strength-at-home", title: "Strength training: the benefits, and how to begin at home", seconds: 161, group: "movement", topic: "strength-training", youtube: "zrEcA-eMHPw", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-381434041", x: "https://x.com/RoplekarSudeep/status/2119139152574943689" } },
  { slug: "how-verve-reads-a-workout", title: "How Verve reads a workout", seconds: 59, group: "movement", topic: "a-workout" },
  { slug: "movement-gate", title: "A racing heart isn't a workout", seconds: 16, group: "movement", topic: "a-workout" },
  { slug: "walking-pace", title: "Walking pace", seconds: 14, group: "movement", topic: "steps", posts: { substack: "https://roplekarsudeep.substack.com/p/daily-step-count-cadence-walking-speed-mortality", x: "https://x.com/RoplekarSudeep/status/2105235198145163608" } },
  { slug: "longest-sit", title: "Your longest sit", seconds: 14, group: "movement", topic: "movement-balance" },
  { slug: "sitting-vs-activity", title: "Does an hour of activity cancel eight hours of sitting?", seconds: 44, group: "movement", topic: "movement-balance", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-351754217", x: "https://x.com/RoplekarSudeep/status/2106294272760889831" } },
  { slug: "rhr-hrr", title: "Resting heart rate and 1-minute recovery", seconds: 54, group: "sleep-heart", topic: "today-tiles", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-347850123", x: "https://x.com/RoplekarSudeep/status/2099038361940099417" } },
  { slug: "2026-10-02-sleep-regularity", title: "Sleep regularity", seconds: 14, group: "sleep-heart", topic: "sleep-rhythm" },
  { slug: "sleep-7-or-8", title: "Seven hours or eight? Duration, regularity and Verve", seconds: 59, group: "sleep-heart", topic: "sleep-rhythm", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-348817511", x: "https://x.com/RoplekarSudeep/status/2104981603533406405" } },
  { slug: "rhr-your-normal", title: "Resting heart rate against your normal", seconds: 14, group: "sleep-heart", topic: "resting-heart-rate" },
  { slug: "arc-rhr-steps", title: "Resting heart rate and daily steps: what is the link?", seconds: 153, group: "sleep-heart", topic: "resting-heart-rate", youtube: "GYjCjnFK1NM", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-382175242", x: "https://x.com/RoplekarSudeep/status/2119487734045958555" } },
  { slug: "hr-recovery", title: "Heart rate recovery: the line is 12", seconds: 14, group: "sleep-heart", topic: "heart-rate-recovery", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-335972832", x: "https://x.com/RoplekarSudeep/status/2099038361940099417" } },
  { slug: "arc-hrv-baseline", title: "Heart rate variability: your own baseline, not a population number", seconds: 95, group: "sleep-heart", topic: "night-hrv", youtube: "6W-DH6RHYLE", posts: { substack: "https://roplekarsudeep.substack.com/p/heart-rate-variability-and-its-effect", x: "https://x.com/RoplekarSudeep/status/2108583576589803682" } },
  { slug: "arc-hrv-trend", title: "Heart rate variability: read your own trend", seconds: 177, group: "sleep-heart", topic: "night-hrv", youtube: "Qa_O0AmbCv0", posts: { substack: "https://roplekarsudeep.substack.com/p/heart-rate-variability-and-its-effect", x: "https://x.com/RoplekarSudeep/status/2108583576589803682" } },
  { slug: "apob", title: "ApoB", seconds: 14, group: "body", topic: "heart-health", posts: { substack: "https://roplekarsudeep.substack.com/p/apolipoprotein-b-apob-why-particle", x: "https://x.com/RoplekarSudeep/status/2119754184983761385" } },
  { slug: "arc-apob-trucks", title: "ApoB: count the trucks, not the cargo", seconds: 172, group: "body", topic: "heart-health", youtube: "_VY6AZBHFhU", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-382719947", x: "https://x.com/RoplekarSudeep/status/2119754184983761385" } },
  { slug: "lpa", title: "Lp(a): test it once", seconds: 14, group: "body", topic: "heart-health", posts: { substack: "https://roplekarsudeep.substack.com/p/lpa-the-trojan-horse-of-the-cardiovascular", x: "https://x.com/RoplekarSudeep/status/2117254754078511227" } },
  { slug: "lpa-risk-multiplier", title: "Lp(a): the lipid molecule that adds additional cardiovascular risk", seconds: 178, group: "body", topic: "heart-health", youtube: "-j1XLCxzWYE", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-376640210", x: "https://x.com/RoplekarSudeep/status/2117254754078511227" } },
  { slug: "arc-cholesterol-2026", title: "Cholesterol: the 2026 guideline makes LDL the target", seconds: 62, group: "body", topic: "heart-health", youtube: "G8A4ZBJ4RA0", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-359167615", x: "https://x.com/RoplekarSudeep/status/2109666719388103092" } },
  { slug: "arc-fh-early", title: "Familial hypercholesterolemia: high cholesterol from birth", seconds: 178, group: "body", topic: "heart-health", youtube: "zOvfRyICjDI", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-386356191", x: "https://x.com/RoplekarSudeep/status/2121235667053113724" } },
  { slug: "arc-remnant-cholesterol", title: "My LDL-c is normal, but I have high remnant cholesterol. Am I at risk?", seconds: 179, group: "body", topic: "heart-health", youtube: "nsjDfmDmEqE", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-378696346", x: "https://x.com/RoplekarSudeep/status/2118034351867019472" } },
  { slug: "insulin-upstream", title: "Glucose rises last: insulin and HOMA-IR", seconds: 29, group: "body", topic: "body-phenotyping", posts: { substack: "https://roplekarsudeep.substack.com/p/fasting-insulin-the-marker-upstream" } },
  { slug: "prediabetes-lifestyle", title: "Prediabetes: can lifestyle stop diabetes?", seconds: 32, group: "body", topic: "body-phenotyping", youtube: "ZyWicHovSOg", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-359170473", x: "https://x.com/RoplekarSudeep/status/2109667458273714250" } },
  { slug: "arc-metabolic-syndrome", title: "Five simple measurements tell if you have metabolic syndrome", seconds: 179, group: "body", topic: "body-phenotyping", youtube: "z7whgObQ8Os", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-379363577", x: "https://x.com/RoplekarSudeep/status/2118322064373203264" } },
  { slug: "bp-safe-limit", title: "Is there a safe limit to blood pressure?", seconds: 39, group: "body", topic: "body-phenotyping", posts: { substack: "https://roplekarsudeep.substack.com/p/is-there-a-safe-limit-to-blood-pressure", x: "https://x.com/RoplekarSudeep/status/2102381851704782865" } },
  { slug: "sprint-under-120", title: "Blood pressure: is a target under 120 worth it?", seconds: 48, group: "body", topic: "body-phenotyping", youtube: "Rr8U9--Oj-U", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-360997552", x: "https://x.com/RoplekarSudeep/status/2110429332158194154" } },
  { slug: "arc-salt-dash-bp", title: "Can cutting salt and changing your diet lower blood pressure?", seconds: 172, group: "body", topic: "body-phenotyping", youtube: "JIUxTl3NDSQ", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-380391136", x: "https://x.com/RoplekarSudeep/status/2118717621634007183" } },
  { slug: "arc-home-bp", title: "White coat and masked hypertension: why measure your BP at home", seconds: 166, group: "body", topic: "body-phenotyping", youtube: "kKYgWiCkhGg", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-388773259", x: "https://x.com/RoplekarSudeep/status/2122291547664425125" } },
  { slug: "grip-strength", title: "Grip strength", seconds: 14, group: "body", topic: "muscle-health", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-356467465", x: "https://x.com/RoplekarSudeep/status/2108405360524661031" } },
  { slug: "sarcopenia-grip-first", title: "Weaker grip, not small muscles: the first sign of sarcopenia", seconds: 161, group: "body", topic: "muscle-health", youtube: "5B3UL_fW4fs", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-371603731", x: "https://x.com/RoplekarSudeep/status/2115076827697852639" } },
  { slug: "intrinsic-capacity", title: "Intrinsic capacity: what you can still do", seconds: 54, group: "body", topic: "intrinsic-capacity", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-347973523", x: "https://x.com/RoplekarSudeep/status/2104614292742095176" } },
  { slug: "gait-speed-survival", title: "Walking speed in the elderly predicts survival", seconds: 130, group: "body", topic: "intrinsic-capacity", youtube: "EDkmPsYXH6U", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-371463918", x: "https://x.com/RoplekarSudeep/status/2115021930936049727" } },
  { slug: "verve-intro", title: "Introducing Verve", seconds: 30, group: "how-verve-works", youtube: "ZYhEf5MGn0E" },
  { slug: "f01-download-signin", title: "Getting started: download Verve and sign in", seconds: 59, group: "how-verve-works", youtube: "FIgu5JqrYQU" },
  { slug: "science-search", title: "Every threshold, one search", seconds: 24, group: "how-verve-works" },
  { slug: "the-guide", title: "The Guide: win, next, body", seconds: 14, group: "how-verve-works" },
  { slug: "the-guide-explained", title: "The Guide, explained (Pro)", seconds: 54, group: "how-verve-works", posts: { x: "https://x.com/RoplekarSudeep/status/2105185512122368133" } },
  { slug: "feature-guide", title: "Verve feature of the day: The Guide", seconds: 129, group: "how-verve-works", posts: { x: "https://x.com/RoplekarSudeep/status/2105185512122368133" } },
  { slug: "ascvd-prevention", title: "Built slowly, prevented daily: lifestyle and ASCVD", seconds: 56, group: "wider-picture", posts: { x: "https://x.com/RoplekarSudeep/status/2107828903486345602" } },
  { slug: "arc-plaque-lifestyle", title: "What builds plaque in your arteries, and what can you do about it?", seconds: 194, group: "wider-picture", youtube: "tmhVjTs0KUk", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-389783821" } },
  { slug: "scot-heart-ct", title: "Heart CT scans: can a scan prevent heart attacks?", seconds: 45, group: "wider-picture", youtube: "LzB3Xs5qPaM", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-360750788", x: "https://x.com/RoplekarSudeep/status/2110353846811992539" } },
  { slug: "arc-coronary-inflammation", title: "Coronary inflammation: what a normal CT can miss", seconds: 174, group: "wider-picture", posts: { substack: "https://roplekarsudeep.substack.com/p/coronary-inflammation-the-biomarker" } },
  { slug: "interheart-risk-factors", title: "Heart attacks: how much does each risk factor matter?", seconds: 158, group: "wider-picture", youtube: "fNY0GHN8iv0", posts: { substack: "https://roplekarsudeep.substack.com/p/what-are-the-risk-factors-that-lead", x: "https://x.com/RoplekarSudeep/status/2114074361783357658" } },
  { slug: "le8-heart-score", title: "Do you know your cardiovascular health score?", seconds: 130, group: "wider-picture", youtube: "2yB8PyA6-Zc", posts: { substack: "https://roplekarsudeep.substack.com/p/life-essential-8-cardiovascular-health-score" } },
  { slug: "arc-family-history-genes", title: "Family history of heart disease: can I do something about it?", seconds: 178, group: "wider-picture", youtube: "L5m4hZoQ5Ic", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-377297709", x: "https://x.com/RoplekarSudeep/status/2115077391274131580" } },
  { slug: "exercise-heart-plaque", title: "Heart plaque: can you exercise too much?", seconds: 139, group: "wider-picture", youtube: "2B15FJrGeGo", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-367478844", x: "https://x.com/RoplekarSudeep/status/2113280969402892377" } },
  { slug: "heart-65mm-imax", title: "65 mm vs IMAX screen: what endurance training does to your heart", seconds: 222, group: "wider-picture", youtube: "Ah30qEa_lRs", posts: { substack: "https://roplekarsudeep.substack.com/p/65-mm-vs-imax-screen", x: "https://x.com/RoplekarSudeep/status/2078035499110035737" } },
  { slug: "smoking-quit-any-age", title: "Smoking: quitting at any age gives years back", seconds: 69, group: "wider-picture", youtube: "0Oo4km38ULM", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-366355403", x: "https://x.com/RoplekarSudeep/status/2112796544349143210" } },
  { slug: "arc-marathon-cpr", title: "Marathon running: low cardiac risk. Know two things.", seconds: 85, group: "wider-picture", youtube: "ppSDuSG0IyQ", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-355056034", x: "https://x.com/RoplekarSudeep/status/2107821805897748540" } },
  { slug: "arc-calories-timing", title: "Weight loss: total calories or meal timing?", seconds: 176, group: "wider-picture", youtube: "BENUmKZdaGc", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-384451854", x: "https://x.com/RoplekarSudeep/status/2120451918233530513" } },
  { slug: "arc-hydration-urine", title: "Your urine color: the simplest hydration test you have", seconds: 179, group: "wider-picture", youtube: "hUf1tPZ4Tcs", posts: { substack: "https://substack.com/@roplekarsudeep/note/c-391355233" } },
];

export const videoSrc = (v: Video) => `/video/${v.slug}/${v.slug}.mp4`;
export const videoPoster = (v: Video) => `/video/${v.slug}/${v.slug}.jpg`;
/** The video itself on YouTube, when it is on the channel. */
export const videoYouTube = (v: Video): string | undefined => (v.youtube ? `https://www.youtube.com/watch?v=${v.youtube}` : undefined);

/** The videos a science topic page carries, in order. */
export const videosForTopic = (topic: string): Video[] => VIDEOS.filter((v) => v.topic === topic);
/** Named videos, in the order named. */
export const videosBySlugs = (slugs: string[]): Video[] => slugs.map((s) => VIDEOS.find((v) => v.slug === s)).filter((v): v is Video => !!v);
export const videosInGroup = (g: VideoGroup): Video[] => VIDEOS.filter((v) => v.group === g);

/** "14 s", "1 min 25 s", "2 min". */
export function fmtSeconds(s: number): string {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}
