/**
 * /search-index.json — everything the science section says, as one file
 * the hub's search reads.
 *
 * Built once, at build time, from the same registry the pages are built
 * from: every topic (its heading, its one-line answer, its sub-headings and
 * its prose, read from the topic's own file), every subject, every body
 * marker with its bands and how-to, and every cited study. A topic added to
 * the registry is searchable the moment it exists; nothing is typed twice.
 *
 * The prose is lifted from the .astro source with the tags and the
 * expressions stripped, which is rough but honest: what is searched is what
 * is on the page, and a hit links to the page, where the reader reads it
 * properly.
 */
import type { APIRoute } from "astro";
import { SUBJECTS, TOPICS, subjectFor, topicHref } from "../data/scienceTopics";
import { BODY_MARKERS } from "../data/bodyMarkers";

export const prerender = true;

const sources = import.meta.glob("../topics/*/*.astro", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const ENTITIES: Record<string, string> = {
  "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”", "&mdash;": "—", "&ndash;": "–",
  "&middot;": "·", "&rarr;": "→", "&larr;": "←", "&amp;": "&", "&nbsp;": " ", "&#8322;": "₂", "&asymp;": "≈",
  "&plusmn;": "±", "&le;": "≤", "&ge;": "≥", "&frac12;": "½", "&hellip;": "…", "&lt;": "<", "&gt;": ">", "&times;": "×",
};
const decode = (s: string) => s.replace(/&[a-z#0-9]+;/g, (e) => ENTITIES[e] ?? " ");
const clean = (s: string) => decode(s.replace(/\{[^{}]*\}/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Headings and prose of one topic file. */
function textOf(src: string): { headings: string[]; text: string } {
  let s = src.replace(/^---[\s\S]*?---/, "");
  s = s.replace(/<!--[\s\S]*?-->/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ");
  const headings = [...s.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g)].map((m) => clean(m[1])).filter(Boolean);
  return { headings, text: clean(s) };
}

export interface SearchEntry {
  /** topic · subject · marker · study */
  k: "topic" | "subject" | "marker" | "study";
  t: string;   // title
  s: string;   // where it sits
  u: string;   // address
  d: string;   // one line
  h: string[]; // sub-headings
  x: string;   // the prose
}

export const GET: APIRoute = () => {
  const entries: SearchEntry[] = [];

  for (const sub of SUBJECTS) {
    entries.push({ k: "subject", t: sub.label, s: "Subject", u: `/science/${sub.slug}`, d: sub.blurb, h: [], x: sub.teaser });
  }
  for (const topic of TOPICS) {
    const key = Object.keys(sources).find((p) => p.endsWith(`/${topic.subject}/${topic.slug}.astro`));
    const { headings, text } = key ? textOf(sources[key]) : { headings: [], text: "" };
    const subject = subjectFor(topic.subject);
    entries.push({ k: "topic", t: topic.label, s: subject.label, u: topicHref(topic.slug), d: topic.sub, h: headings, x: text.slice(0, 6000) });
    for (const c of topic.citations) {
      entries.push({ k: "study", t: c.title, s: topic.label, u: topicHref(topic.slug), d: c.summary.slice(0, 200), h: [], x: c.summary });
    }
  }
  for (const m of BODY_MARKERS) {
    entries.push({
      k: "marker", t: m.label, s: "Body marker", u: `/science/body/body-phenotyping#${m.slug}`, d: m.purpose, h: [],
      x: [m.note, ...m.bands, ...m.howTo, m.citation, m.retest?.interval ?? ""].join(" "),
    });
  }

  return new Response(JSON.stringify(entries), { headers: { "content-type": "application/json; charset=utf-8" } });
};
