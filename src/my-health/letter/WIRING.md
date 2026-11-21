# The weekly letter, sent from our own address

Canvas "Verve, Horizon as a programme", board 32. The founder, 20 November 2026: "build what you mocked". Built as
drawn: plain text, no pictures, a test required before Send, sent on the press, replies to hello@.

The letter is written on the website by the account that reads the list, and sent by the `letter` function to the
confirmed rows of `newsletter_signups`. Substack is no longer the sender.

| File | What it holds |
|---|---|
| `src/my-health/views/TheLetter.tsx` | Settings › For the team › The letter. Five small pages: Write, See it, Send yourself one, Send, After. Under them, every letter that has gone. |
| `src/my-health/letter/letter.ts` | The page's arithmetic and words: which page a letter is on, whether the words changed since a test, the checks, why a send stopped, pasting. Pure; `tests/letter.test.mjs`. |
| `src/my-health/letter/api.ts` | Drafts (rows in `letters`), the counts, and the three calls to the function. |
| `src/pages/unsubscribe.astro` | A link from a weekly letter carries `&l=<letter id>`, so the letter's record can say how many left after it. |
| METTracker `supabase/functions/letter/` | `render.ts` draws the email. `index.ts` previews, tests, sends, hears the sender's reports, and takes a mailbox's own Unsubscribe press. `hook.ts` checks a report is the sender's. |
| METTracker `supabase/migrations/20261122_letters.sql` | `letters`, `letter_sends`, and the functions the page and the sender call. |

## Rules

- **One place draws a letter.** The page shows the HTML the function returns, in a frame that runs nothing. It has
  no renderer of its own, so what is seen is what leaves.
- **A test first.** Send is refused, by the function, until a test of these exact words has gone. The words are
  compared by a sum (`wordsHash`), worked out the same way on both sides; one fixed input is pinned in the tests of
  both repositories.
- **The number typed is the number there is.** The recipients are written once, when Send is pressed, and only if
  the count has not changed. An address added while a letter is going gets the next one.
- **Nobody gets a letter twice.** One row for each (letter, address). Rows are handed to the sender as a named
  batch; a batch that was handed over and never marked is handed over again under the same name, and the sender
  does not send a named batch twice. "Send to the rest" takes up from the rows still queued.
- **Who can send.** The account in `list_readers`, checked by the database for a draft and by the function for a
  send. The sender's key never reaches the browser.
- **What every letter carries.** Why the reader gets it, with their own day; their own Unsubscribe button, and the
  one a mailbox shows beside the sender's name. No pixel, and no link that reports a press.
- **A count the sender has not reported is a dash.** Delivered, bounced and marked-as-spam come from the sender's
  reports. Until they are switched on (a webhook and its secret), the page shows a dash and says why.
- **A test goes to the reader's own address.** Or, when asked, to an address that is already a confirmed row on the
  list. That second way is not on the board: an account that signs in with Apple has an address Apple may not pass
  mail to, and a test that cannot arrive would keep Send shut for ever.

## Not built

- A richer editor, pictures, and sending at a set hour (the board's other ways).
- Reading the letters that went from Substack before this. They are not in `letters`.
- The app's question is its own pull request in METTracker (`feat/letter-question`).
