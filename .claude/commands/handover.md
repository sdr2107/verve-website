# Handover: the Verve website and app, as of 2 October 2026

Read this whole file, then the memory index (it loads on its own), then say in three lines what you understand the state to be and ask what to do next. Do not start work until asked.

## The two repos, side by side on this Mac

- **Website** (this folder): `/Users/sudeeproplekar1/Desktop/verve-website`. Astro 7 + Tailwind v4, deployed by GitHub Pages on every push to `main` at https://verve-app.health. Build: `npm run build`. Dev server: port 4321, config `.claude/launch.json` (name `verve-website`). The big page is `src/pages/my-health.astro`, one inline TypeScript module of about 4,900 lines; type-check it by extracting the `<script>` block to `src/pages/.tmp-check.ts` and running the app repo's `node_modules/.bin/tsc` with a loose config (the site has no TypeScript installed). Shared data in `src/data/site.ts` (nav, Social accounts), `src/data/plans.ts` (dormant flags).
- **App** (sibling): `/Users/sudeeproplekar1/Desktop/METTracker`, GitHub `sdr2107/verve-met-tracker`, Expo SDK 55, React Native 0.83, TypeScript. Checks: `npx tsc --noEmit -p .` and `npx jest`. The phone runs a development build; every change today was JavaScript, so `npx expo start --dev-client` in that folder shows it live; a new EAS build is needed only for native changes (`eas build --platform ios --profile development`).
- **Supabase** project `tlrkkciovzjzqsjoacus` (Mumbai). Migrations live in `METTracker/supabase/migrations/`; Sudeep pastes the SQL in the dashboard himself, never `supabase db push`. Function secrets hold provider keys; nothing secret is in code.

## Rules Sudeep set

- One commit per build step, on `main`. Never push unless he says; a site push deploys the live site. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Copy: calm, honest, blunt, no digs at rivals; numbers counted from data, never typed.
- Design asks arrive as `/design` briefs: make a Design canvas, mock first, build when he says "build what you mocked". Stay true to the mocks.

## Where things stand

- Everything from the two October canvases is built, committed and pushed except the last three commits (see `git log origin/main..main` in both repos): the canvases are https://claude.ai/artifact/AFmnjM4w4A2vuPosHg9Kq3 (eleven questions, now twelve boards) and https://claude.ai/artifact/XMWbxVyZ7sx3XdCWNxx7BD (sleep in one place).
- The migration `20261002_daily_signals_more_and_weight.sql` has been run.
- Dormant and switched off: the Plans page, the plan gate, billing, the AI summary. The memory file `dormant-switches.md` lists each flag and secret; recite it when he says the business details are in.
- Open ideas he raised, not built: athletes and coaches paying for deep history from JSON or CSV uploads (the site now reads every row an import leaves, however far back); km splits in the workout sheet (needs a native distance reader); Android weight history (the bridge returns an empty list for now).

## How to work with him

He is a radiologist building Verve alone around a full-time job. He likes to be quizzed, then given one recommendation. He reviews on the phone and the live site and comes back with numbered lists; answer every number, in order. When a request is a question, answer it; when it is "build", build and commit each step; when a step is blocked, finish the rest and say what was left.
