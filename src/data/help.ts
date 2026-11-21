/**
 * Help: six doors, and the short answers behind each (canvas "Verve, Horizon as a programme", board 33;
 * asked for by the founder on 20 November 2026). The page is src/pages/help.astro; src/help/WIRING.md says how
 * it hangs together.
 *
 * "How it works" answers what this is. Help answers why something is not working.
 *
 * HOW AN ANSWER IS WRITTEN
 * - One or two sentences, in the words the product itself uses on the page the answer is about.
 * - One link at the end, to the place where the thing is done.
 * - No advice about health. A question about a result is not for this page.
 * - TRUE. Each answer below names, in the comment above it, the code it was checked against on 20 November
 *   2026. When that code changes, the answer changes with it. An answer nobody can check is taken out.
 *
 * Pure data, so tests/help.test.mjs can read it: every answer has exactly one link, and every link is an
 * address this site serves.
 */

import { PLANS_PAGE_PUBLIC, FREE_AND_PRO_PATH } from "./plans.ts";

/** Where the form's message is read. One address for the whole site (data/site.ts COMPANY.email). */
export const HELP_EMAIL = "hello@verve-app.health";

export interface HelpLink {
  label: string;
  /** A path on this site, or `#write` for the form on the Help page itself. */
  href: string;
}
export interface HelpQuestion {
  q: string;
  a: string;
  link: HelpLink;
}
export interface HelpDoor {
  /** The door's address: /help/#<id>. */
  id: string;
  title: string;
  /** One line under the title on the first page. */
  blurb: string;
  questions: HelpQuestion[];
}

/** The form's own address on the Help page. */
export const WRITE_ID = "write";

const MY = "/my-health/";
const REPORTS: HelpLink = { label: "Open Reports", href: `${MY}#reports` };
const SHARING: HelpLink = { label: "Open Sharing", href: `${MY}#settings-sharing` };
const EMAILS: HelpLink = { label: "Open Email and notifications", href: `${MY}#settings-email` };
const DATA: HelpLink = { label: "Open Data", href: `${MY}#settings-data` };
const SIGN_IN: HelpLink = { label: "Open the sign-in card", href: MY };
const WEARABLES: HelpLink = { label: "See what each wearable writes", href: "/how-it-works#wearables" };

export const HELP_DOORS: HelpDoor[] = [
  {
    id: "numbers",
    title: "A number is missing, or looks wrong",
    blurb: "Dashes, late readings, a fitness figure you do not recognise.",
    questions: [
      // my-health/views/Overview.tsx ("A row with nothing to show reads a dash and the reason, never a zero");
      // topics/sleep-heart/wearables.astro ("shows as a dash, never a zero, and the row says why when it can");
      // views/Settings.tsx DevicesBlock (the list of what each device sends)
      { q: "A row shows a dash.",
        a: "A dash means nothing arrived for that day. It is never a zero, and the row says why when it can.",
        link: { label: "See what your devices share", href: `${MY}#settings-devices` } },
      // pages/how-it-works.astro ("reads the phone's health store and nothing else"); views/Settings.tsx
      // DevicesBlock and METTracker lib/signalsSync.ts (Back up watch readings: off unless switched on)
      { q: "My watch has it and Verve does not.",
        a: "Verve reads your phone's health store and nothing else. This site shows watch readings only when Back up watch readings is on in the app, and it is off until you switch it on.",
        link: WEARABLES },
      // METTracker lib/signalsSync.ts (SIGNALS_WINDOW_DAYS = 35: "Apple writes a night's stages and a workout's
      // recovery some time after the fact and a row already pushed may need its figures filled in")
      { q: "A number changed since yesterday.",
        a: "A night's sleep or a workout's recovery can reach the phone's health store some time after the fact. On every sync the app sends the last 35 days again, so a day already shown may be filled in.",
        link: WEARABLES },
      // my-health/derive/fitness.ts VO2_CAVEAT; views/Overview.tsx (the row "Estimate", "Verve's own test · no
      // wearable needed"); components/FirstNumber.astro (six-minute walk, twelve-minute run)
      { q: "My fitness figure looks low.",
        a: "A fitness figure estimated by a wearable misses the lab figure by 7 to 16 % on average, and the page marks it Estimate. A test of your own needs no wearable: a six-minute walk or a twelve-minute run.",
        link: { label: "Find your number", href: "/#find-your-number" } },
    ],
  },
  {
    id: "signing-in",
    title: "Signing in",
    blurb: "Which account you are in, two accounts, a code that did not arrive.",
    questions: [
      // pages/my-health.astro showWhoAmI ("Signed in with …", "an address Apple made to hide your own")
      { q: "Which account am I in?",
        a: "Settings, under Profile, shows how you signed in and with which address. An address ending in privaterelay.appleid.com is one Apple made to hide your own.",
        link: { label: "Open Profile", href: `${MY}#settings-profile` } },
      // pages/my-health.astro mergeOtherAccounts ("the same email behind another login … moves every row from
      // the other account into this one") and the sign-in card ("Apple with a hidden address makes an account
      // nothing else can join")
      { q: "I seem to have two accounts.",
        a: "Signing in one way once and another way once can make two accounts, and Verve joins them the next time you sign in when both carry the same email address. An account made with an address Apple hides stays apart, so use the Apple button to reach it.",
        link: SIGN_IN },
      // pages/my-health.astro, the code step ("one email carries the code and the link", "It expires in one
      // hour", "Resend the code" after sixty seconds, "a code cannot reach an address Apple hides")
      { q: "The sign-in code did not arrive.",
        a: "The email carries a code and a link, both last one hour, and after a minute the card offers Resend the code. If you signed up with Apple in the app, use the Apple button: a code cannot reach an address Apple hides.",
        link: SIGN_IN },
      // pages/my-health.astro ("The login is the one you use in the app"; Profile: "The same sign-in as the
      // app. The name is the one the app greets you with.")
      { q: "Is it the same account as the app?",
        a: "Yes: one account works in the app and here, and the name is the one the app greets you with.",
        link: { label: "Sign in", href: MY } },
    ],
  },
  {
    id: "reports",
    title: "Reports and blood tests",
    blurb: "Adding a report, a value read wrongly, what is sent to the app.",
    questions: [
      // pages/my-health.astro, the drop zone ("A PDF, a photo of the report as JPG, PNG or WebP … up to 15 MB
      // each … originals stay in your private archive")
      { q: "How do I add a report?",
        a: "On Reports, drop the file or tap to choose it: a PDF, or a photo of the report as JPG, PNG or WebP, up to 15 MB each. The original stays in your private archive.",
        link: REPORTS },
      // pages/my-health.astro, the review ("check anything Verve misread"; each value in a number box; "Untick
      // to leave this value out"); views/Reports.tsx (the card's "Read again")
      { q: "A value was read wrongly.",
        a: "Verve can misread a report, so each value headed for your app sits in a box you can change before you confirm, and unticking one leaves it out. Read again on the report's card opens that review once more.",
        link: REPORTS },
      // pages/my-health.astro, the review's two tiers ("GOES TO YOUR APP · Metabolic · Heart · Muscle", "STAYS ON
      // THE WEBSITE"); data/site.ts AUTO_SEND_TO_APP; views/Reports.tsx ("awaiting your check there")
      { q: "What reaches the app, and what stays here?",
        a: "The markers the app tracks, under Metabolic, Heart and Muscle, go to your app and wait there for your check. Everything else a report holds stays on this site.",
        link: { label: "Open Body", href: `${MY}#body` } },
      // pages/my-health.astro, deleting a report ("The PDF is removed; its values stay"); public/privacy
      // ("Email us to have particular values removed")
      { q: "Can I remove a report?",
        a: "Delete on the report's card removes the PDF, and the values read from it stay. To have particular values removed, write to us.",
        link: { label: "Write to us", href: `#${WRITE_ID}` } },
    ],
  },
  {
    id: "sharing",
    title: "Sharing with a coach or a doctor",
    blurb: "Inviting someone, what they can see, stopping it.",
    questions: [
      // pages/my-health.astro, Give access ("Their email", "What they see", "Send the invitation", "They get an
      // email with a link that signs them in. Nothing is shared until they open it.")
      { q: "How do I invite someone?",
        a: "Open Sharing, type their email, tick what they may see, and send the invitation. They get an email with a link that signs them in, and nothing is shared until they open it.",
        link: SHARING },
      // my-health/derive/scopes.ts SCOPE_LABEL and offeredScopes; pages/my-health.astro ("They can look, not change")
      { q: "What exactly can they see?",
        a: "Only what you tick: Labs, Imaging, Activity and fitness, Body measurements, or Sleep and heart. They can look, not change.",
        link: SHARING },
      // pages/my-health.astro, the list under "Has access" (each share has Change and Stop)
      { q: "How do I stop sharing?",
        a: "The same sheet lists everyone who has access. Each has Change, to tick or untick what they see, and Stop.",
        link: SHARING },
    ],
  },
  {
    id: "plan",
    title: "Plan, payment and emails",
    blurb: "What Pro adds, where it is managed, turning an email off.",
    questions: [
      // pages/how-it-works.astro ("free shows your numbers, Pro reads them. Nothing free is taken away when a
      // trial ends", the table of gates); views/Settings.tsx PlanBlock ("the Guide's reads and Horizon")
      { q: "What does Pro add?",
        a: "Free shows your numbers, and Pro reads them: the Guide's written reads, every retest, the longer history and Horizon. Nothing free is taken away when a trial ends.",
        link: PLANS_PAGE_PUBLIC ? { label: "See every plan", href: "/plans" } : { label: "See what is free and what is Pro", href: FREE_AND_PRO_PATH } },
      // views/Settings.tsx PlanBlock, word for word
      { q: "Where do I manage or cancel it?",
        a: "Where you bought decides where you manage it: the App Store, Google Play, or here. It is the same Pro in all three.",
        link: { label: "Open Plan and billing", href: `${MY}#settings-plan` } },
      // views/Settings.tsx EmailBlock ("every email turns itself off in one click"; the switches for Your week
      // and a horizon's check-ins)
      { q: "How do I turn an email off?",
        a: "Every email turns itself off in one click, from the link at its foot. The switches for the weekly email and for a horizon's check-ins are also in Settings, under Email and notifications.",
        link: EMAILS },
      // pages/unsubscribe.astro (three links, three switches: the letter, Your week, a horizon's check-ins)
      { q: "I unsubscribed and still got one.",
        a: "There are three emails, each with its own switch: the weekly letter, Your week on Mondays, and a horizon's check-ins. Turning one off leaves the other two as they were.",
        link: EMAILS },
    ],
  },
  {
    id: "data",
    title: "Your data",
    blurb: "Downloading it, and deleting the account.",
    questions: [
      // pages/my-health.astro, Settings › Data ("Export as CSV", "Export as JSON"; "the file holds what the page shows")
      { q: "How do I download everything?",
        a: "Settings, under Data, has two downloads: CSV and JSON. The file holds what the page shows.",
        link: DATA },
      // pages/my-health.astro, Settings › Data ("Everything on this account goes with it, here and in the app.
      // It cannot be undone."); public/privacy (the app's own Delete account)
      { q: "How do I delete my account?",
        a: "Settings, under Data, has Delete my account, and the app has the same button. Everything on the account goes with it, here and in the app, and it cannot be undone.",
        link: DATA },
      // public/privacy ("deletes, at once …: your account, your backup, your uploaded reports and every value
      // read from them, … your shares and notes, your newsletter sign-up"); METTracker
      // supabase/functions/delete-account
      { q: "What is kept after I delete?",
        a: "Nothing on our servers. Your account, your backup, your reports and every value read from them, your shares and your newsletter sign-up are deleted at once.",
        link: { label: "Read the privacy policy", href: "/privacy/" } },
    ],
  },
];

/** A door by its address, or undefined. */
export const doorOf = (id: string): HelpDoor | undefined => HELP_DOORS.find((d) => d.id === id);
/** Every address the Help page answers to: the first page, each door, the form. */
export const HELP_VIEWS: string[] = ["help", ...HELP_DOORS.map((d) => d.id), WRITE_ID];
