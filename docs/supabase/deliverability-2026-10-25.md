# Auth email deliverability — findings of 2026-10-25

Two password-reset emails landed in junk: a Yahoo inbox (2026-09-25) and
a Gmail inbox reached through Apple's Hide-my-email relay (2026-10-25).
Checked on 2026-10-25: the DNS with `dig`, the Supabase SMTP and template
screens, the Resend domain page, and the raw copy of today's reset email
in Resend's log.

## 1. DNS for verve-app.health — what is there

| Record | Value found | Verdict |
|---|---|---|
| `verve-app.health` TXT (SPF) | `v=spf1 include:_spf.google.com include:amazonses.com ~all` | OK. One SPF record, 4 of 10 lookups. `amazonses.com` is there for Apple's relay registration (newsletter HOW-IT-WORKS §9), keep it. |
| `send.verve-app.health` MX | `10 feedback-smtp.us-east-1.amazonses.com` | OK — Resend's bounce (Return-Path) host. Resend shows it Verified. |
| `send.verve-app.health` TXT | `v=spf1 include:amazonses.com ~all` | OK — Resend's SPF for the envelope sender. Verified. |
| `resend._domainkey.verve-app.health` TXT | `p=MIGf…` (RSA 1024-bit) | OK. Resend signs `d=verve-app.health`, aligned with the From. Verified. Gmail's floor is 1024. |
| `google._domainkey.verve-app.health` TXT | `v=DKIM1; k=rsa; p=MIIB…` (2048-bit) | OK — Workspace mail is signed too. |
| `_dmarc.verve-app.health` TXT | `v=DMARC1; p=none;` | **Incomplete.** No `rua`, so nobody receives the reports that would show which mail fails and why. |
| DNSSEC | none | Fine; not a spam signal. |

SPF, DKIM and DMARC alignment are all in place for mail Resend sends from
an `@verve-app.health` address. There is no authentication gap that
explains the junking.

## 2. Supabase and Resend — confirmed in the dashboards

Supabase → Authentication → Emails → SMTP Settings (project
tlrkkciovzjzqsjoacus): custom SMTP on, sender `hello@verve-app.health`,
sender name `Verve`, host `smtp.resend.com`, port 465, username `resend`.
All right; nothing to change. `hello@` is a real Workspace mailbox, the
welcome email's From, and the address registered with Apple for relay
delivery.

Resend → Domains → verve-app.health: Verified, region us-east-1, DNS
provider Namecheap, all three records Verified. No tracking subdomain is
configured, so click and open tracking are off (right for a one-link
transactional email). TLS opportunistic. "Resend Forge" not activated.

Resend's log, last 15 days: five emails, all Delivered. Today's reset went
out 13:19 UTC as `"Verve" <hello@verve-app.health>` to the
`privaterelay.appleid.com` address and Resend shows Delivered — to Apple's
relay, which then forwarded it to Gmail. Five emails in two weeks is the
volume of a domain with no reputation yet, at Yahoo or anywhere.

Resend's own Insights on that email:

- **Needs attention: link URLs do not match the sending domain.** The one
  link is `https://tlrkkciovzjzqsjoacus.supabase.co/auth/v1/verify?…`.
- Possible improvement: send from a subdomain (so the apex keeps its own
  reputation). Low priority at this volume.
- Doing great: DMARC present, plain-text part present, body small, no
  "no-reply", no images, tracking on no shared domain.

## 3. The template — what the raw message showed

Supabase sends the HTML only; **Resend adds the text/plain part by
converting the HTML.** The raw copy of today's email showed that
conversion, and it carried two of the triggers we were looking for, in
the text part rather than the HTML:

```
HERE IS YOUR CODE TO RESET YOUR PASSWORD.
…
Open My health to set it
[https://tlrkkciovzjzqsjoacus.supabase.co/auth/v1/verify?token=…&type=recovery&redirect_to=verve://auth-callback]
```

- **All-caps headline — fixed today.** Resend's converter writes every
  `<h1>` in capitals. The headline is now a `<p role="heading">` with the
  same styles, so the text part reads "Here is your code to reset your
  password." HTML rendering is unchanged.
- **Bare URL in the text part — inherent.** The converter writes each
  link as its text plus the URL in brackets. The link stays (it is the
  "device that asked" path); the lever is the domain it points to (§4).
- `<html>` tag — **fixed today**: the template was a bare `<div>`, so the
  HTML part had no html/head/body (SpamAssassin HTML_MIME_NO_HTML_TAG).
  It is now a full document with doctype, `lang="en"`, charset and title.
- Code block: six digits, monospace, letter-spaced. Fine. Images, remote
  fonts, hidden text, tracking pixels: none. Fine.
- **The dashboard still holds the old template** (bare div, `<h1>`), read
  today on the Reset password screen. Paste the whole file into Supabase →
  Authentication → Emails → Templates → Reset password and save.

The confirm-signup, magic-link and invite templates have the same bare-div
shape and `<h1>` headlines, so their text parts shout too; same wrapper
and same `<p role="heading">` change when they are next touched.

## 4. DNS records to add (at Namecheap, where the zone lives)

**DMARC with reporting (add now; replaces the existing `_dmarc` TXT):**

```
Host:  _dmarc
Type:  TXT
Value: v=DMARC1; p=none; rua=mailto:dmarc@verve-app.health; ruf=mailto:dmarc@verve-app.health; fo=1; adkim=r; aspf=r; pct=100
```

First create `dmarc@verve-app.health` in Google Workspace (an alias on
hello@ is enough). Reports arrive daily as XML attachments from Google,
Yahoo and Microsoft; after two to four weeks of clean reports, tighten:

```
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@verve-app.health; fo=1; adkim=r; aspf=r; pct=100
```

`p=quarantine` is what Yahoo and Gmail reward; `p=none` is only the
minimum they tolerate.

**The one lever left on content: a Supabase custom domain.** Resend's
Insights flag it and it is the only "needs attention" item. Supabase's
Custom Domains add-on (paid) makes the link `auth.verve-app.health`, on
the sending domain. If taken up, the record is:

```
Host:  auth
Type:  CNAME
Value: tlrkkciovzjzqsjoacus.supabase.co
```

plus the TXT verification record the Supabase dashboard prints at the
time. Every `tlrkkciovzjzqsjoacus.supabase.co` in the app and site then
changes too; separate work, not for today.

## 5. What the two junked emails say

- **Yahoo, 2026-09-25.** Same day as the template rewrite, from a domain
  that had sent almost no mail; the Resend log shows it still sends a
  handful a fortnight. Yahoo weights domain age and volume heavily and
  gives new low-volume domains the junk folder until a few recipients mark
  mail as not spam. The capitals headline and the supabase.co link in the
  text part did not help.
- **Gmail via Apple's relay, 2026-10-25.** Resend delivered to Apple;
  Apple's relay rewrites the From to a `privaterelay.appleid.com` address
  and re-signs, so at Gmail the mail authenticates as Apple's: our DNS has
  little say. What Gmail judges is the forwarding path plus content plus
  the reader's history with the sender. The reader fixes this inbox in one
  step (Not spam, or add the address to Contacts); on our side the content
  fixes above are what remain.

## 6. How to see for yourself

1. In the junked Gmail message: ⋮ → Show original. Read
   `Authentication-Results`: `spf=`, `dkim=` (which `d=`), `dmarc=`, and
   `arc=`. That one header settles whether this was authentication or
   reputation.
2. Send one auth email to a mail-tester.com address (sign up a throwaway
   account on verve-app.health/my-health with the address it shows, then
   delete that user in Supabase → Authentication → Users). The page scores
   SpamAssassin, SPF, DKIM, DMARC and the HTML for the same sending path.
3. Add the domain to Google Postmaster Tools (postmaster.google.com) with
   the TXT it prints; it shows Gmail's spam rate and domain reputation
   once volume is above its floor.
4. In Resend, each email's Insights tab repeats the link-domain check;
   after the template is pasted, its Plain Text tab should show the
   headline in sentence case.

## 7. The app repo

No code change. `app/(auth)/forgot-password.tsx` requests the reset with
`redirectTo: "verve://auth-callback"` and verifies the code with
`verifyOtp(type "recovery")`; the email's content and headers are decided
in Supabase and Resend, not in the app. Nothing was committed there.
