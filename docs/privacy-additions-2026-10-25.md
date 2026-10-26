# Privacy policy: two additions (draft, 25 Oct 2026, updated 26 Oct for Messages, NOT published)

These two sections go into the live policy (`public/privacy/index.html`) and the 1.6.3 rewrite
(`docs/privacy-pending-1.6.3.html`). Place them after "Notes by a coach or clinician". They follow
the existing wording on Anthropic. Check them with Spice Route if their review is still open.
Nothing below goes live until you say so; the written read stays switched off until then.

---

## Messages and files with a coach or clinician

If you share your page with a coach or clinician, you and they can send each other messages and files
(PDFs or images up to 15 MB, for example a training plan), and pin the plan you are working to. Each
message is dated, shows who sent it, and shows when it was read. Messages and files are stored on our
Supabase servers in Mumbai, the files in a private store opened only through a short-lived link.

Either of you can write only while your share is active, and no one can change a message after it is sent.
The thread belongs to you: if you stop sharing, you keep every message and file, and the coach or clinician
can no longer see them (they keep only what they exported). Messages and files are deleted when you delete
your account or the page they belong to. Verve does not read, use or analyse them, and they are never sent
to an AI provider. Messages are not for emergencies.

**Weekly report.** You can choose to send a coach or clinician an automatic weekly report on the day you
pick (Monday unless you change it). It contains last week's figures as the app counts them: your activity
dose against your goal, minutes of moderate to vigorous activity, strength days, average steps, resting
heart rate and any fitness test, and only the parts your share allows. It is written by our database from
your numbers, not by an AI. You can turn it off at any time, and it stops when the share stops.

## The Guide's read on the website

On the In depth part of My health you can ask for a short written read of your page. It is off until
you turn it on, and it runs only when you ask for it.

When you ask, our server sends the numbers the page has already worked out to Anthropic's Claude model
to write the read: your age band and sex, and computed figures such as your fitness test results,
weekly activity, sleep and heart readings, and which lab values sit inside or outside each report's own
printed range. **Your name, your email address, your report files, the wording of your reports and any
notes are never sent.** If you look at someone else's page through a share, only what their share
covers is sent, and only after we check you are allowed to see it.

Under Anthropic's commercial terms the request and the reply are not used to train models and are
deleted from Anthropic's systems within 30 days, unless retained for legal or safety reasons. We keep
the written read on our Supabase servers in Mumbai so the page does not ask again until your numbers
change; it is deleted when you delete your account. The read is wellness information, not a
diagnosis or medical advice.

---

### Facts behind the wording (checked in the code, 25 Oct)
- messages: `METTracker/supabase/migrations/20261026_messages.sql` — either side writes on an active share
  only; no edits (only `read_at`); the person reads always, the viewer only while active; files in the private
  bucket `threads`, 15 MB, PDF/PNG/JPEG/WebP, signed links of two minutes; weekly report by
  `post_weekly_reports()` (pg_cron, hourly, posts once on the chosen day) from activities, daily_signals,
  crf_entries, by scope (activity → dose, minutes, strength days, steps, tests; heart → resting HR);
  cascade-deleted with the page or the share.
- written read: `METTracker/supabase/functions/depth-summary/index.ts` — sends "structured numbers,
  already computed — plus an age band and sex. Never a name, an email, a report file, a doctor's
  printed words, or a note"; checks the caller may see the person; stores the summary per person and
  viewer with a hash of the input; shares the 50-a-day AI limit.
- To switch it on after the policy is published: `AI_SUMMARY_OPEN = true` in
  `verve-website/src/data/plans.ts`, and the function secret `DEPTH_SUMMARY_OPEN=true`.
