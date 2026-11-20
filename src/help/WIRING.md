# Help

Canvas "Verve, Horizon as a programme", board 33. Asked for by the founder on 20 November 2026: "Why does help
page go to the videos section? what is the use case of help button?" Until then the account menu's Help was a link
to How it works, which opens on the videos.

**"How it works" answers what this is. Help answers why something is not working.**

| File | What it holds |
|---|---|
| `src/data/help.ts` | THE DOORS AND THE ANSWERS: six doors, twenty-two questions. Above each answer, the code it was checked against. Pure; `tests/help.test.mjs`. |
| `src/pages/help.astro` | The page: the first page, one small page behind each door, and the form. One address, one page shown at a time. |
| `src/help/form.ts` | What the form checks before it sends, and the two things it may add. Pure; `tests/help.test.mjs`. |
| `src/data/site.ts` | `HELP_PATH`, and Help in the footer's row. |
| `src/pages/my-health.astro` | The account menu's Help item (`#helpgo`), and "Trouble signing in?" under the sign-in card. |
| METTracker `supabase/functions/help-message/` | The function the form calls, and `supabase/migrations/20261123_help_messages.sql`, its table. |

## The addresses

| Address | What is shown |
|---|---|
| `/help/` | "What are you stuck on?" and the six doors |
| `/help/#numbers` | A number is missing, or looks wrong |
| `/help/#signing-in` | Signing in |
| `/help/#reports` | Reports and blood tests |
| `/help/#sharing` | Sharing with a coach or a doctor |
| `/help/#plan` | Plan, payment and emails |
| `/help/#data` | Your data |
| `/help/#write` | Write to us |

Without a script every page is on the screen in order, each address lands on its own heading, and the form says
where to write instead.

## Rules

- **An answer is one or two sentences, in the product's own words, and ends in one link** to the place where the
  thing is done. The test holds each answer to that.
- **Every answer is true, and says where it was checked.** `tests/help.test.mjs` reads the product's files for the
  lines the answers lean on. When one of those lines changes, the test fails, and the answer is read again. Two
  answers lean on the app's code, which this repository cannot read: that watch readings reach the site only with
  Back up watch readings on, and that each sync sends the last 35 days again (METTracker `lib/signalsSync.ts`).
- **No advice about health.** The first page says so, and says who to contact when unwell.
- **The form adds only what it shows.** The page the person came from (this site's own path, no query, no id) and
  the browser in a few words, while the box is ticked. Never a figure.
- **A reply needs an address that can be reached.** Signed in, it is the account's. Where Apple hides that
  address, or nobody is signed in, the form asks for one.
- **The form fails honestly.** When the function is not there, refuses, or cannot pass the message on, the page
  says so and gives hello@verve-app.health. It says "Sent" only when the function says the message was passed on.
- **No promise about when a reply comes.**
- **No chat window, no bot, no search box.** Six doors fit on one screen.

## Order to go live

1. The SQL: METTracker `supabase/migrations/20261123_help_messages.sql`.
2. The app repository's pull request, then `supabase functions deploy help-message --use-api`.
3. This repository's pull request.

Out of order nothing breaks: until the function is deployed, the form says it could not send and gives the
address to write to.

## Not built

- A search box. A door that needs more than a handful of questions is the sign to add one.
- A page for the founder to read the messages on. They arrive at hello@; the table is the record.
- A rule for how long a message is kept. The table keeps them until the account is deleted, or until they are
  removed by hand.
