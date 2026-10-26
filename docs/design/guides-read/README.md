# The Guide's read as a premium section (design, 26 Oct 2026)

Mock-ups: 1-overview (where it sits), 2-read (one read), 3-library (your reads, filed), 4-premium (what
people pay for), 5-coach (a read per client). Today the read is a card inside In depth; nothing here is
built yet.

## Where it sits
- **First on the page:** a quiet hero band at the top of Overview with the latest read's opening lines,
  "Read it in full" and "Write a new read". **Second in the sidebar:** "✦ The Guide's read" with a PRO mark.
- **Calm by design:** a serif reading face for the prose, one soft violet glow, generous space, no scores,
  no alarms, no streaks. The read is wellness information, said once on every read.

## One read (2-read)
A one-line title, two or three sentences, "Worth a conversation" items tagged DOCTOR or COACH (each with a
"Learn" link to the matching science page), what is due, and the provenance line ("Read from 23 sessions,
31 nights and 3 lab reports"). On the right: **Filed in your reads**, **Share with [coach]** (into Messages),
**Download PDF**, **Add my note**, and "Since your last read", what moved between this read and the one before.

## Your reads (3-library): file it and learn from it
Every read kept by date with its title, its tags, whether it was shared or downloaded, and notes. Filters
(doctor items, coach items, with my notes), **Compare two reads**, "What your reads keep saying" (the items
that recur), and a small trend of the weekly dose at each read.

## What is paid (4-premium) — recommendation
- **Free:** the first read, then one read a month (enough to show the value; the app's Guide stays one a week).
- **Pro (the person):** a read whenever the numbers change, the library, compare, share, PDF, notes.
- **Coach / Clinician plan:** a read for every client who shares, written each Monday beside the weekly
  report; the client list with each client's doctor and coach items (5-coach); export a client's reads.
- No price on screen until it is set (website plans are dormant today: PLANS_OPEN false).

## Rules that stay
- Only the page's computed numbers go to the AI; never the name, email, report files, report wording, notes
  or messages. A client's read uses only what they share; a client can turn reads off.
- Every number in a read must be in the input or the sentence is dropped (the function already enforces it).
- The policy already describes the read; filing, sharing and PDFs need one line added ("reads are kept until
  you delete them or your account").

## Build plan (about 2–3 days)
1. Table `guide_reads` per person and viewer (input hash, title, body JSON, created_at, shared_at, note).
   The depth-summary function writes a row instead of overwriting the cached one, and adds a title.
2. The hero band on Overview, the sidebar entry, the read page with its actions (share = a Messages post of
   kind "read"; PDF from the page; note).
3. The library, compare (two reads side by side) and "keep saying" (counts over stored items).
4. The Monday client reads for the coach plan (the weekly-report job calls the function per opted-in share).
5. Gating when plans open: free = first read + one a month.
