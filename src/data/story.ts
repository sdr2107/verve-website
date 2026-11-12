/**
 * story — Verve in four questions, said once (11 Nov 2026; canvas "Verve, one
 * story in four parts"). The founder's framing: here I am today; this is how
 * I was; this is what stands out; this is where I am going. My health's four
 * pages each answer one, in this order, and the landing page, How it works,
 * the sign-in card and the Overview's doors all read these lines, so the
 * story cannot be told two ways.
 *
 * The pages keep their names; the questions are how they are explained. What
 * the story may say: where you stand, how your own figures moved, what stands
 * out in them, what you are aiming for. What it may not: that Verve finds,
 * watches for or warns of anything; that a person will reach a result; that a
 * read is advice. The third part is "what stands out", never "what you did
 * not know": beside blood results, a promise to reveal reads as "detects".
 */
export interface StoryPart {
  key: "overview" | "depth" | "guide" | "horizon";
  /** The page's name in My health. */
  name: string;
  question: string;
  /** One line: what the page does. */
  line: string;
  /** A longer line for How it works. */
  more: string;
  /** Free, or what Pro adds. */
  plan: string;
  /** A sample figure for the landing page, shown under a "Sample figures" chip. */
  sample: { figure: string; unit: string };
}

export const STORY_TITLE = "Your health, in four questions";
export const STORY_LINE = "See where you stand, how you got here, what stands out, and where you are going.";

export const STORY: StoryPart[] = [
  {
    key: "overview", name: "Overview", question: "Where am I today?",
    line: "Your figures, each set against the line clinicians use.",
    more: "Six sections: Fitness, Vitals, Sleep, Exertion, Movement, Body. This week so far, the latest test and the latest report, each figure with the device that wrote it. Every marker's own chart is one press away, at every range.",
    plan: "Free",
    sample: { figure: "8.9", unit: "METs" },
  },
  {
    key: "depth", name: "In depth", question: "How did I get here?",
    line: "Each marker across a year, against where you started, blood work beside fitness.",
    more: "Five windows, one month to three years; one year opens first, because it sets the same season against itself. Each marker has a card of its own: where you stood when the window began, your average across it and where you stand now, over a chart with its own scale. Blood work is drawn from six months up, and a change between two reports is said to be inside, at the edge of, or more than that marker's usual swing. A new wearable is marked on the line; a stretch with nothing logged is left empty.",
    plan: "Pro",
    sample: { figure: "8.1 → 8.9", unit: "" },
  },
  {
    key: "guide", name: "The Guide", question: "What stands out?",
    line: "A short read of your own figures, with the study behind each line.",
    more: "At most three things, a sentence or two each, written by an AI model from the numbers on your page and nothing else. Every figure is counted before the Guide sees it, and a sentence with a number that is not on your page is dropped. It describes; it does not advise. Each line leads into time, or onto Horizon as a draft.",
    plan: "The first read is free; Pro reads every week, the month and the year",
    sample: { figure: "3", unit: "things" },
  },
  {
    key: "horizon", name: "Horizon", question: "Where am I going?",
    line: "A date you set, the figures you want by then, a check-in each Monday.",
    more: "Three, six or twelve months, or a date of your own. You set every number; Verve sets none and promises none. It tells you the pace your number implies and, each Monday, whether the weeks are keeping it.",
    plan: "Pro",
    sample: { figure: "9 Feb", unit: "" },
  },
];
