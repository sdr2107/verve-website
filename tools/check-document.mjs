#!/usr/bin/env node
/**
 * check-document — calls my_health_document as a signed-in account and
 * asserts the shape in src/my-health/document.ts, with timing.
 *
 *   REVIEWER_EMAIL=… REVIEWER_PASSWORD=… node tools/check-document.mjs [person-id]
 *
 * Exits 1 on a missing key, a wrong kind, or an error from the function.
 * Prints the size of every list, so a change to the function is read
 * against the previous run. No credential lives in this file.
 */
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/lib/supabase.ts", import.meta.url), "utf8");
const URL_ = src.match(/SUPABASE_URL = "([^"]+)"/)[1];
const KEY = src.match(/SUPABASE_ANON_KEY =\s*"([^"]+)"/)[1];
const keysSrc = readFileSync(new URL("../src/my-health/document.ts", import.meta.url), "utf8");
const block = keysSrc.slice(keysSrc.indexOf("export const DOCUMENT_KEYS"));
const KEYS = Object.fromEntries([...block.matchAll(/(\w+): "(list|object|string)"/g)].map((m) => [m[1], m[2]]));

const email = process.env.REVIEWER_EMAIL, password = process.env.REVIEWER_PASSWORD;
if (!email || !password) { console.error("set REVIEWER_EMAIL and REVIEWER_PASSWORD"); process.exit(2); }

const auth = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
}).then((r) => r.json());
if (!auth.access_token) { console.error("sign-in failed", auth); process.exit(1); }

const person = process.argv[2] ?? null;
let doc, bytes = 0, times = [];
for (let i = 0; i < 3; i++) {
  const t = performance.now();
  const r = await fetch(`${URL_}/rest/v1/rpc/my_health_document`, {
    method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(person ? { person } : {}),
  });
  const text = await r.text(); times.push(Math.round(performance.now() - t)); bytes = text.length;
  if (!r.ok) { console.error("function error", r.status, text.slice(0, 400)); process.exit(1); }
  doc = JSON.parse(text);
}
console.log(`my_health_document · ${times.join(" / ")} ms · ${(bytes / 1024).toFixed(0)} KB`);

let bad = 0;
for (const [k, kind] of Object.entries(KEYS)) {
  const v = doc[k];
  const ok = kind === "list" ? Array.isArray(v) : kind === "string" ? typeof v === "string" : (v === null || (typeof v === "object" && !Array.isArray(v)));
  if (!(k in doc) || !ok) { console.error(`✗ ${k}: expected ${kind}, got ${v === undefined ? "missing" : JSON.stringify(v)?.slice(0, 60)}`); bad++; }
}
for (const k of Object.keys(doc)) if (!(k in KEYS)) { console.error(`✗ ${k}: in the document but not in document.ts`); bad++; }
const sizes = Object.entries(doc).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k} ${v.length}`).join(" · ");
console.log(sizes);
console.log(`person ${doc.person?.name ?? "—"} (${doc.person?.id ?? "none"}) · me ${doc.me?.email} · role ${doc.me?.role ?? "—"} · profile ${doc.profile ? "yes" : "none"}`);
if (bad) { console.error(`${bad} problem${bad === 1 ? "" : "s"}`); process.exit(1); }
console.log("shape ok");
