# The letter's one list

Canvas "Verve, Horizon as a programme", boards 27 to 29. Decided by the founder on 19 November 2026: one list, the
press in the welcome, our own sender, and a page to follow the list on.

**One table.** Every address for the letter is a row in `newsletter_signups` (METTracker
`supabase/migrations/20261121_one_list.sql`). Nothing is carried to another place by hand.

| File | What it holds |
|---|---|
| `src/data/letter.ts` | The sentence beside the box's button, and `tagOf`: the word a post's link may carry (`/horizon?from=clip-12`). |
| `src/components/LetterBox.astro` | The box on the Horizon page. Writes the row (door `horizon`, with the word on the link), then asks `newsletter-welcome` for the first letter. |
| `src/components/SheetBox.astro` | The box on /start and /sheet, as before (door `start`). |
| `src/pages/confirm.astro` | The press in the welcome: calls `newsletter_confirm` with the row's token. |
| `src/pages/unsubscribe.astro` | The way out, as before, and one button that puts an address back (the same token, `newsletter_confirm`). |
| `src/my-health/list/list.ts` | THE ARITHMETIC of the reader's page: a row's state, the six counts, the weeks, the doors, the posts, the file out, Substack's file in. Pure; `tests/list.test.mjs`. |
| `src/my-health/list/api.ts` | Reads the list, listens to it, hands Substack's file to the database. |
| `src/my-health/views/TheList.tsx` | Settings › For the team › The list. |

## The doors

| Door | Who writes it | Confirmed |
|---|---|---|
| `horizon` | The box on the Horizon page | By the press in the welcome |
| `start` | The box on /start and /sheet | By the press in the welcome |
| `my-health` | The newsletter question on My health | At once, when the address is the account's own |
| `app` | The question the app asks once (not built yet) | At once, when the address is the account's own |
| `substack` | The list's reader, from Substack's file | On the day it subscribed there |

## Rules

- **The weekly letter goes to confirmed rows only.** A row is confirmed by a press made from its own mailbox, or
  because a signed-in account added its own verified address. An address somebody else typed gets one email.
- **A stopped row stays.** Unsubscribe marks it. It is never deleted by the page, so the address is not added again
  by mistake. A press on "Yes, send me the weekly letter", or on "Put me back on the list", starts it again.
- **Who reads the list is the database's decision**, not the page's (`list_readers`, `list_reader()`). The page's
  code is public. An account that is not a reader is answered with no rows, and no account can read a row's token,
  change a row or delete one through the page.
- **Live, with a floor.** The page listens to the table and reads it again each minute. If the line is not open it
  says "Read again each minute" in place of "Live".
- **The word on a link says which post brought an address and nothing else.** No page is tracked after it, and no
  letter carries a pixel.
- **The Horizon page is still linked from no page of the site** (`tests/programme.test.mjs`). The first letter links
  to it, and posts will. Its door in the bar waits (board 30).

## Not built

- Sending the weekly letter from our own sender. Until then it still goes from Substack.
- The app's question.
- The block in the Monday email for an account with no horizon (board 26).
- The clip on the Horizon page. No clip exists yet.
