# My health: the load and render architecture

Written 2026-10-09, before any of it is built. The page as it stands is
`src/pages/my-health.astro`: 5,673 lines, one `<script>`, 139 functions,
52 module-level variables that loaders mutate and renderers read, 43 places
that write HTML strings into the page. A signed-in visit makes about 28
requests in three serial waves and draws nothing until the last wave is
back; every tab or section click throws its DOM away and redraws it with
the rise animation. The recording of 2026-10-09 shows ten seconds to the
last number on a warm network, and a redraw on every click.

The fix is not a faster query. It is giving the page the three things it
does not have: one document that means "this person's page", a place that
document is kept on the device, and views that are a function of it.

## What the page becomes

```
                 ┌──────────────────────────────────────────────┐
  Supabase       │ my_health_document(person)  → one JSON       │
  (Mumbai)       │ SQL function, SECURITY INVOKER: RLS applies  │
                 └──────────────┬───────────────────────────────┘
                                │ one request, after the session check
                                ▼
  Browser   ┌─────────────┐   ┌──────────────┐   ┌─────────────────────┐
            │ inline head │──▶│ document     │──▶│ views (Preact)      │
            │ fetch, no   │   │ store        │   │ overview · labs ·   │
            │ bundle yet  │   │ IndexedDB    │   │ reports · in depth  │
            └─────────────┘   │ stale-while- │   │ · people            │
                              │ revalidate   │   │ rendered from the   │
                              └──────────────┘   │ document, once      │
                                                 └─────────────────────┘
```

Reads go through the document. Writes (uploads, the parser, sending values
to the app, notes, grants, people, the AI summary) stay exactly as they
are, and each one ends by asking the store to refresh the document. The
page never reads a table directly again.

## The five steps

### 0. A ruler before the work

`performance.mark()` at six points: script start, session known, cache
painted, document received, document painted, first interaction. A
`console.table` of them in development, and a `?timing=1` query that
shows them on the page. Every later step is measured against the recording
of 2026-10-09 with this ruler, on the reviewer account, in the built-in
browser. No step is called done on feel.

### 1. One document, one round trip

**Migration** `METTracker/supabase/migrations/2026MMDD_my_health_document.sql`:

```sql
create or replace function public.my_health_document(person uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'generated_at', now(),
    'me',       (select jsonb_build_object('id', auth.uid(), 'email', auth.email(),
                   'name', ..., 'role', ..., 'plan', ...)),
    'people',   (select jsonb_agg(p order by created_at) from people p),
    'grants',   (select jsonb_agg(g) from grants g where g.viewer_id = auth.uid() and g.status = 'active'),
    'person',   (select to_jsonb(p) from people p where p.id = person),
    'labs',     (select jsonb_agg(l order by measured_on) from web_labs l where l.person_id = person),
    'imaging',  (select jsonb_agg(i order by report_date) from imaging_reports i where i.person_id = person),
    'app_labs', (select jsonb_agg(r order by measured_at) from lab_readings r
                   join people p on p.account_id = r.user_id where p.id = person and r.deleted_at is null),
    'weeks',    ..., 'crf', ..., 'body', ...,            -- web_weeks, web_crf, web_body
    'activities', ..., 'signals', ..., 'weights', ...,   -- the app's rows, by the person's account
    'app_crf', ..., 'waist', ..., 'profile', ...,
    'reports',  (select jsonb_agg(w) from web_reports w where w.person_id = person),
    'files',    (select jsonb_agg(jsonb_build_object('name', o.name, 'size', o.metadata->'size', 'at', o.created_at))
                   from storage.objects o where o.bucket_id = 'reports' and o.name like <the person's folder> || '/%'),
    'note',     (select note from person_notes where person_id = person),
    'sharing',  (select jsonb_agg(g) from grants g where g.owner_id = auth.uid() and g.person_id = person),
    'requests', ..., 'invites', ..., 'asked', ...,
    'ai',       (select jsonb_build_object('summary', ..., 'consent', ...))
  );
$$;
revoke all on function public.my_health_document(uuid) from public, anon;
grant execute on function public.my_health_document(uuid) to authenticated, service_role;
```

- `SECURITY INVOKER`, so every row-level policy already in place
  (`can_view_person(person, scope)`, `can_see_person`, the storage read
  policies) decides what the document contains. A viewer with the labs
  scope and not the heart scope gets `signals: null`. No new policy, no new
  trust.
- The report folder comes from `storage.objects` under the existing read
  policies, so the Storage API call goes too.
- `merge_accounts_by_email` is a write and stays its own call, run after
  the first paint; `note_grant_view` likewise.
- Paging disappears: a `jsonb_agg` is the whole set. For the founder that is
  about 900 activity rows and 525 lab rows, under 200 KB gzipped. The
  function stays `stable`, so PostgREST can cache nothing but the planner
  can.
- **The shape has one owner in TypeScript**: `src/my-health/document.ts`
  declares `MyHealthDocument`; `tools/check-document.mjs` fetches the
  function for the reviewer account and asserts every key and type, and
  compares row counts with the old queries. Run before the old loaders are
  deleted.
- Grants in the same migration file (the rule of 2026-10-30 applies to
  functions as `grant execute`).

### 2. The document store: paint from the last visit first

`src/my-health/store.ts`, about 120 lines, no library:

- IndexedDB database `my-health`, object store `documents`, key
  `${userId}:${personId}`, value `{ doc, savedAt }`.
- `openDocument(personId)`: returns the cached document synchronously if
  present and starts the fetch; `onDocument(doc)` fires once for the cache
  and once for the fresh one when `generated_at` differs. The views render
  from whichever is newest.
- `refreshDocument()`: what every write path calls when it is done.
- A document older than 30 days is not painted, only used to know the
  person; a document for a person no longer in `people` is deleted.
- Private mode or a blocked IndexedDB falls through to network only.

Boot becomes: session from local storage, paint the cached document
(sub-100 ms after the script), then one request, then re-render. The
"Reading your numbers…" line and the skeleton frames are shown only when
there is no cached document, which is a first visit.

### 3. Views as a function of the document

This is the rewrite. The 43 `innerHTML` writes and the five renderers that
rebuild every tab become components that take the document and return
DOM, rendered once per document and shown or hidden on navigation.

- **Library:** Preact with `@preact/signals` through `@astrojs/preact`:
  4 KB and 2 KB, keyed DOM diffing, TSX components, no runtime in the
  marketing pages. The document is one signal; the views derive from it;
  a fresh document re-renders only the nodes whose values changed, so a
  revalidation does not flash. Chosen over a vanilla render-once because
  the page already has ten interactive states (ranges, years, the focus
  tile, the expanded analyte, the review flows) that a diffing renderer
  handles and string rebuilding never will.
- **Layout:** `src/my-health/` with `document.ts`, `store.ts`, `session.ts`,
  `derive/` (the pure summaries that exist today: `sleepHeartSummary`,
  `fitnessSummary`, `activitySummary`, `labRowsFrom`, `markerPointsFrom`,
  the lens maths, moved out unchanged and given tests under node),
  `views/` (Overview with its four sections and the glance, Labs, Reports,
  InDepth, People, Auth), `motion.ts` (the rise and the draw, once per
  session, stagger capped at 300 ms, honouring `prefers-reduced-motion`).
  `my-health.astro` keeps the HTML shell, the signed-out copy and the
  styles, and mounts the app.
- **Order of migration, one tab per commit, each shipped behind the same
  URL:** Overview first (it is what the recording shows), then Labs, then
  In depth, then Reports (the upload and review flows move last and
  unchanged, they only read the document and call `refreshDocument()`),
  then People and the group. The old renderer of each tab is deleted in the
  commit that replaces it; nothing runs twice.
- **The animation rule:** a view animates on the first paint of the
  session and never again. The `riseOnce` set becomes a store flag.
- **What the views keep:** every number, word and rule on the page today.
  This step moves code, it does not change readings. The derive functions
  carry their tests to prove it.

### 4. Start the request before the bundle

- An inline `<script type="module">` of about 40 lines at the top of the
  page reads the Supabase session from local storage
  (`sb-<ref>-auth-token`), checks `expires_at`, reads the remembered
  person from session storage, and starts a plain `fetch` of
  `/rest/v1/rpc/my_health_document` with the stored access token. The
  promise is kept on `window.__mh.document`; the store awaits it instead of
  making its own request. An expired session skips this and the bundle's
  auth client refreshes as it does now.
- The read path needs no Supabase client: the store uses `fetch`. The
  client stays for auth events and the write paths, and is imported
  dynamically by the code that writes.
- Reports, Labs and In depth are dynamic imports, fetched on first
  opening. The first-paint bundle is the shell, the store, the Overview
  views and Preact: well under 100 KB.

### 5. Prefetch the page from the marketing site

- `astro.config.mjs`: `prefetch: { defaultStrategy: "hover" }`, and
  `data-astro-prefetch` on the My health link in `SiteHeader.astro`. The
  HTML of the page arrives before the click.
- The inline script of step 4 then starts the data request on the first
  parse of that HTML, so by the time the bundle lands, the document is
  usually already in.

## What does not change

- Sign-in: email, Apple, Google, magic link, the invite token in the URL,
  the coach's and clinician's doors, the one-time merge of accounts under
  one email.
- Hash routing (`#overview-body`, `#labs`, …) and the person remembered
  per session.
- Every reading, rule, band and sentence. The science links.
- The parser edge function, the upload flow, the review flows, sending
  values to the app, the newsletter prompt.
- The static hosting on GitHub Pages: there is still no server of ours.

## Verification, per step

| Step | Proof before it is called done |
|---|---|
| 0 | the six marks print for the reviewer account; the baseline is recorded in this file |
| 1 | `tools/check-document.mjs` passes for the reviewer account and for a viewer with partial scopes; the old loaders deleted; marks show one request |
| 2 | second visit paints from cache before the request returns, measured; the fresh document re-renders without a flash |
| 3 | each tab: a screenshot pair, old and new, for the reviewer account; the derive tests pass; a section click re-renders nothing but the section |
| 4 | the document request appears in the network log before the main bundle finishes; first-paint bundle size recorded |
| 5 | hovering My health on the landing page fetches it; the click shows the shell within one frame |

The target, from the ruler: a returning visit shows the page with
numbers within 300 ms of the script starting, and the fresh document
within one network round trip after that; a first visit shows numbers
within one round trip of the session check; a tab or section switch
costs no network and no redraw.

## Risks, named

- **The function's size.** One `jsonb_agg` per table is simple but an
  account with years of activities will produce a large document. The
  store caches it, so it is paid once per change, and the `since` window
  the page already uses (2000) can be narrowed per table later without
  touching the views.
- **Step 3 is where the time goes.** Five tabs, each with its own states.
  Doing it one tab per commit keeps the live page whole at every point,
  and the derive functions moving first means the numbers are provably
  the same before any view is rewritten.
- **Two code paths during the migration.** The old renderers and the new
  views would both read from the document for a while. The rule is that
  the document is the only source from the end of step 1, so the old
  renderers are converted to read it before the views replace them.
- **The inline fetch and the session format.** The token's storage key
  and shape belong to the Supabase client. The inline script treats a
  shape it does not recognise as "no session" and lets the client do the
  work; it can never break sign-in, only lose the head start.

## Order and size

| Step | Files | Size |
|---|---|---|
| 0 ruler | `my-health.astro` | an hour |
| 1 document | migration, `document.ts`, `check-document.mjs`, `my-health.astro` loaders | a day |
| 2 store | `store.ts`, `session.ts`, boot | a day |
| 3 views | `src/my-health/**`, `@astrojs/preact` | three to five days, one tab a commit |
| 4 head start | inline script, dynamic imports | half a day |
| 5 prefetch | `astro.config.mjs`, `SiteHeader.astro` | an hour |

Steps 1, 2, 4 and 5 are independent of 3 and ship on their own. The page
is faster after step 2 even with the old renderers; step 3 is what makes
it smooth.

## Record

**Step 0, the ruler** (2026-10-09): six `performance.mark`s, printed with
`?timing=1`. The baseline is the recording of the same morning on the live
page: ten seconds to the last number, a redraw on every click. The ruler was
born with step 1, so the old code was never measured by it.

**Step 1, the document** (2026-10-09, website commit after 07b072f, app
migration a7fad0e run in prod): `my_health_document(person)` is live and the
page reads nothing else for a person. Measured on the reviewer account on the
dev server, Mumbai from Dubai, a reload:

| mark | before | after |
|---|---|---|
| requests to Supabase on a reload | about 28, in three waves (plus the whole set three times over: boot ran on load and again on every auth event) | 3: the document, the account merge, the role chip |
| painted | about 10 s on the live recording | 600 to 800 ms, the document itself 200 to 800 ms |

Found on the way and fixed: `boot()` ran three times per load, once from the
script and once per auth event, so every table was read three times; it now
runs once per signed-in account. The `my_plan` function was asked for on every
load and does not exist; the plan is "free" until the plans open.

Document sizes, uncompressed JSON, from the function as the admin role: a new
account 22 KB; the founder's own person 1.4 MB (896 workouts, 1,838 signal
days with every column, 295 lab values, 5 reports). Step 2 caches it, so it
is paid once per change; narrowing `signals` to the columns the page reads
is the first thing to do if the fresh fetch is felt.

Still read outside the document: the group glance for people besides you
(`loadGlance`), the viewer's note on a shared page, the role chip's grants,
and every write.
