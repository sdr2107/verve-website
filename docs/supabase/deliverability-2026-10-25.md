# Auth email deliverability — findings of 2026-10-25

Two password-reset emails landed in junk: a Yahoo inbox (2026-09-25) and
a Gmail inbox reached through Apple's Hide-my-email relay (2026-10-25).
Everything below was checked with `dig` from the founder's Mac on
2026-10-25; the two dashboards (Supabase SMTP settings, Resend domain
settings) need a sign-in and were not read.

## 1. DNS for verve-app.health — what is there

| Record | Value found | Verdict |
|---|---|---|
| `verve-app.health` TXT (SPF) | `v=spf1 include:_spf.google.com include:amazonses.com ~all` | OK. One SPF record, 4 of 10 lookups. `amazonses.com` is there for Apple's relay registration (newsletter HOW-IT-WORKS §9), keep it. |
| `send.verve-app.health` MX | `10 feedback-smtp.us-east-1.amazonses.com` | OK — Resend's bounce (Return-Path) host. |
| `send.verve-app.health` TXT | `v=spf1 include:amazonses.com ~all` | OK — Resend's SPF for the envelope sender. |
| `resend._domainkey.verve-app.health` TXT | `p=MIGf…` (RSA 1024-bit) | OK. Resend signs `d=verve-app.health`, aligned with the From. 1024 bits is Resend's key; Gmail's floor is 1024. |
| `google._domainkey.verve-app.health` TXT | `v=DKIM1; k=rsa; p=MIIB…` (2048-bit) | OK — Workspace mail is signed too. |
| `_dmarc.verve-app.health` TXT | `v=DMARC1; p=none;` | **Incomplete.** No `rua`, so nobody receives the reports that would show which mail fails and why. |
| DNSSEC | none | Fine; not a spam signal. |

SPF, DKIM and DMARC alignment are all in place for mail Resend sends from
an `@verve-app.health` address. There is no authentication gap that
explains the junking; the remaining levers are reputation, the link
domain, and the forwarding path.

## 2. DNS records to add (at Namecheap, where the zone lives)

**DMARC with reporting (add now, replaces the existing `_dmarc` TXT):**

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

**Optional, the one lever that changes the email's content: a Supabase
custom domain.** The reset link today points at
`https://tlrkkciovzjzqsjoacus.supabase.co/auth/v1/verify?...`, a shared
domain used by every Supabase project, including phishing kits. Supabase's
Custom Domains add-on (paid) makes it `auth.verve-app.health`, so the one
link in the email is on the sending domain. If taken up, the record is:

```
Host:  auth
Type:  CNAME
Value: tlrkkciovzjzqsjoacus.supabase.co
```

plus the TXT verification record the Supabase dashboard prints at the time.
Every `tlrkkciovzjzqsjoacus.supabase.co` in the app and site then changes
too; that is a separate piece of work, not for today.

## 3. Supabase SMTP settings — to confirm in the dashboard

Not readable without a sign-in. Check at Supabase → Authentication → SMTP
Settings (project tlrkkciovzjzqsjoacus):

- Sender email is an `@verve-app.health` address — `hello@verve-app.health`
  is the right one: the mailbox exists in Workspace, it is the From of the
  welcome email, and it is the address registered with Apple for relay
  delivery. A `noreply@` with no mailbox bounces every reply and matches
  nothing Apple knows.
- Sender name is `Verve`.
- Host `smtp.resend.com`, port 587 (or 465), username `resend`.

And in Resend (resend.com → Domains → verve-app.health):

- Status Verified, region us-east-1 (matches the MX above).
- **Click tracking and open tracking OFF.** Tracking rewrites the reset
  link through Resend's shared tracking domain and adds a pixel; both are
  classic junk signals on a one-link transactional email and tracking
  breaks "the link works only on the device that asked".

## 4. The template

`reset-password-email.html`, checked against the usual triggers:

- Code block: six digits, monospace, letter-spaced. Not all-caps text. Fine.
- Links: one, with sentence text ("Open My health to set it"), no bare URL. Fine.
- Images, remote fonts, hidden text, tracking pixels: none. Fine.
- Plain-text part: **missing, and the template cannot add one.** Supabase
  sends the template as the message's only part (text/html). SpamAssassin
  scores that as MIME_HTML_ONLY (~0.7). The only fix is Supabase's Send
  Email Hook, which would hand the mail to Resend's API with both an
  `html` and a `text` body. Worth it only if the DMARC reports and a
  mail-tester run still show trouble after the steps above.
- `<html>` tag: **was missing** (the template was a bare `<div>`, so the
  HTML part had no html/head/body). SpamAssassin HTML_MIME_NO_HTML_TAG.
  **Fixed today**: the template is now a full document with doctype,
  `lang="en"`, charset and a title; the content is unchanged. Paste the
  whole file into the Supabase template screen. The confirm-signup,
  magic-link and invite templates have the same bare-div shape and would
  take the same wrapper.

## 5. What else the two junked emails say

- **Yahoo, 2026-09-25.** Same day as the template rewrite, from a domain
  that had sent almost no mail. Yahoo weights domain age and volume
  heavily and gives new low-volume domains the junk folder until a few
  recipients mark mail as not spam. DMARC reporting will show whether
  Yahoo saw a pass; `p=quarantine` later helps the score.
- **Gmail via Apple's relay, 2026-10-25.** Apple's relay rewrites the From
  to a `privaterelay.appleid.com` address and re-signs the mail, so at
  Gmail the mail authenticates as Apple's, not ours: our DNS has little
  say. What Gmail judges is the forwarding path plus content plus the
  reader's history with the sender. The reader can fix this inbox in one
  step (mark Not spam, or add the address to Contacts); on our side the
  content fixes (html wrapper, tracking off, hello@ sender) are what
  remain.

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

## 7. The app repo

No code change. `app/(auth)/forgot-password.tsx` requests the reset with
`redirectTo: "verve://auth-callback"` and verifies the code with
`verifyOtp(type "recovery")`; the email's content and headers are decided
in Supabase and Resend, not in the app. Nothing was committed there.
