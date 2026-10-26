# Messages: the care thread between a person and their coach or clinician (design, 26 Oct 2026)

Mock-ups: `thread.png` (the conversation), `inbox.png` (the coach's or clinician's list of people),
`share.png` (what the person allows). Nothing here is built yet.

## The idea in one line
One dated thread per share, belonging to the person, holding messages, files, the current plan, test
results and an automatic weekly report. Both sides see the same history. Nothing is lost when a plan ends.

## What is in it
1. **Messages, both ways.** Plain text, dated, with "read" marks. This replaces today's one-way feedback; the
   feedback already sent moves into the thread as its first messages.
2. **Files.** PDFs up to 15 MB from either side (training plan, discharge letter, a lab report the clinician
   wants to discuss). Stored in a private bucket under the person, opened through a short-lived link.
   A lab PDF can be sent on to the report reader with one tap, by the person only.
3. **The current plan, pinned.** The coach pins a plan with a name, start and end dates and the PDF; the thread
   shows "Week 6 of 8" and the retest date. When the end date passes the plan closes on its own and is kept.
4. **The weekly report, automatic (opt-in by the person).** Every Monday, built from the same numbers as the
   app's Week in Review: dose against the goal, moderate–vigorous minutes, strength days, steps, resting
   heart rate, any new test. Only the scopes the person ticked. It stops when the person turns it off, when
   the share stops, or when the plan ends (the person's choice). No AI writes it; it is the numbers.
5. **Test results and retests** post into the thread when logged (6-minute walk, Cooper run), so a coach sees
   "+60 m" or "+1.3 METs" against the ACC's own bars without asking.
6. **History and export.** Filters (messages, files, weekly reports, tests) and an export of the whole thread
   as a PDF or CSV, by either side, at any time.
7. **The coach's or clinician's list.** Everyone who shares with them: last week's dose, the plan week, what is
   due, and what is new; sorted by what needs them first.

## Rules (privacy and safety)
- **The person owns the thread.** When they stop sharing, the coach loses access; the person keeps everything.
  The coach keeps only what they exported. Verve stays out of being anyone's medical record.
- **Not for emergencies.** A fixed line in the thread: messages may not be read quickly; for symptoms call
  your doctor or emergency services.
- **No AI reads the thread.** Messages and files are never sent to an AI provider.
- **Notifications by email** for a new message or report, with no health details in the email ("You have a new
  message on Verve"). Off per person if they wish.
- The privacy policy needs a "Messages and files between you and your coach or clinician" section before launch
  (draft it with the two sections already waiting).

## Build plan (about 3 to 4 days of work)
1. Tables: `threads` (one per grant), `messages` (body, sender, created_at, read_at, kind: text | file | report |
   test | plan), `thread_files` (path, name, size), `plans` (name, start, end, file). Row rules as for feedback:
   both sides read while the share is active; the person always. Storage bucket `threads`, private.
2. Website: a Messages tab on a person's page, the composer with attach, the pinned plan, filters, export.
3. The weekly report: a scheduled function (Mondays, 07:00 in the person's time zone) that writes one `report`
   message per opted-in share, from the synced weeks.
4. The coach's list: the People view with last week, plan week, next and new.
5. Phase 2: the thread in the app (read and reply), and push notifications.

## Choices for you
- **Name:** "Messages" (plain) or "Care thread".
- **Who can start it:** the person only, or either side once the share includes "Messages". Recommended: the
  person ticks "Message each other and share files" when giving access; on by default for coaches and clinicians.
- **Weekly report day:** Monday by default, the person can change it.
- **Reply time promise:** none (recommended), or let each professional set "I reply within 2 working days".
