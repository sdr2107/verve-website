/**
 * What a founding member of the community is shown, where it differs from the team's own view (the founder,
 * 27 November 2026).
 *
 * A founding member is an account the programme is on for that is not one of Verve's own: the two flags the page
 * already keeps (../known.ts accessFlags; ../state.ts isTester, isTeam). One of the team's accounts previewing as a
 * founding member holds the same two flags (./preview.ts seenFlags), so it is drawn the same way.
 *
 *   THE GUIDE'S PAGE   "for skool we can hide the guide page from the website - we have it in the app for skool users
 *                      - so it would be overview, depth, horizon only". Hidden for a founding member: no tab, no
 *                      strip on the Overview, no "ask the Guide" on In depth, and its address opens the Overview. The
 *                      team and every other account keep it. GUIDE_FOR_FOUNDING turns it back on.
 *   HOW LONG           "6 months and 12 months should be locked with a lock sign for skool founders - that opens up
 *                      after the 12 weeks and once they pay monthly subscription". A founding member sets a horizon of
 *                      three months; the longer ones are drawn with a lock and one line. There is nothing to pay with
 *                      yet, so the line names no price and carries no link. The horizon function refuses the same
 *                      (METTracker supabase/functions/horizon/length.ts, which holds its own copy of the three months:
 *                      change both together).
 *
 * Pure; tests/member.test.mjs runs it under node. The horizon function does not copy this file.
 */
export type AccountFlags = { /** The programme is on for the account. */ tester: boolean; /** It is one of Verve's own. */ team: boolean };

/** A founding member: the programme is on, and the account is not the team's. */
export const isFoundingMember = (f: AccountFlags): boolean => f.tester && !f.team;

/** Whether a founding member is shown the Guide's page on the website. Off since 27 November 2026: they have the Guide in the app. */
export const GUIDE_FOR_FOUNDING: boolean = false;
/** Whether the Guide's page, its tab and every way into it are drawn for an account. */
export const guidePageShown = (f: AccountFlags): boolean => GUIDE_FOR_FOUNDING || !isFoundingMember(f);

/**
 * Whether the set-up offers "More choices": the seven-card set-up of 18 November 2026 (views/Programme.tsx
 * ProgrammeSetup) and, from it, "My own targets". Hidden for EVERYONE on 27 November 2026, the team too. The founder
 * pressed it and met "the old page with 7 steps"; asked what a member needs of it, the answer was what the short
 * set-up already holds: how long, the five numbers, the three questions about health, and the Monday email. The day
 * to be ready for, the other goals, who writes the plan (a coach among them), what the page reads, and a diet chart
 * or a watched marker are not asked. His words: "dont delete anything from the codebase - see what we need and hide
 * the rest". All of that code is still here; set this to true to bring the link and the old set-up back.
 */
export const SETUP_MORE_CHOICES: boolean = false;

/** The longest horizon a founding member sets, in months. The horizon function holds the same figure (length.ts). */
export const FOUNDING_LONGEST_MONTHS = 3;
/** Whether a length is drawn with a lock for this account. */
export const lengthLocked = (months: number, founding: boolean): boolean => founding && months > FOUNDING_LONGEST_MONTHS;
/** The one line under the locked lengths. No price and no link: there is no way to pay yet. */
export const LENGTH_LOCKED_LINE = "Longer horizons open after your 12 weeks, with a subscription.";
