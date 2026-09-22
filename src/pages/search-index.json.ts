/**
 * /search-index.json — everything the science section says, as one file
 * the hub's search reads.
 *
 * Built once, at build time, from the same registry the pages are built
 * from: every topic (its heading, its one-line answer, its sub-headings and
 * its prose, read from the topic's own file), every heading inside a topic
 * as a hit of its own that lands on that heading, every subject, every body
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

/** One heading inside a topic: its id (the anchor), its text, and the prose under it up to the next heading. */
interface Section { id: string; title: string; text: string }

/**
 * Headings and prose of one topic file. Every heading must carry an id:
 * that id is where a search hit lands, and a heading without one would
 * land the reader at the top of the page with no idea why. So the build
 * stops here and names the heading rather than shipping a hit that
 * misses.
 */
function textOf(src: string, where: string): { sections: Section[]; text: string } {
  let s = src.replace(/^---[\s\S]*?---/, "");
  s = s.replace(/<!--[\s\S]*?-->/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ");
  const heads = [...s.matchAll(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g)];
  const sections: Section[] = heads.map((m, i) => {
    const title = clean(m[3]);
    const id = /\bid="([^"]+)"/.exec(m[2])?.[1];
    if (!id) throw new Error(`Heading "${title}" in ${where} has no id, so a search hit could not land on it. Give it id="…" and class="scroll-mt-8 vrv-anchor".`);
    const from = m.index! + m[0].length;
    const to = i + 1 < heads.length ? heads[i + 1].index! : s.length;
    return { id, title, text: clean(s.slice(from, to)).slice(0, 1200) };
  }).filter((x) => x.title);
  return { sections, text: clean(s) };
}

export interface SearchEntry {
  /** topic · section (a heading inside a topic) · subject · marker · study */
  k: "topic" | "section" | "subject" | "marker" | "study";
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
    const { sections, text } = key ? textOf(sources[key], key) : { sections: [], text: "" };
    const subject = subjectFor(topic.subject);
    entries.push({ k: "topic", t: topic.label, s: subject.label, u: topicHref(topic.slug), d: topic.sub, h: sections.map((x) => x.title), x: text.slice(0, 6000) });
    // each heading is its own hit, landing on its own anchor
    for (const sec of sections) {
      entries.push({ k: "section", t: sec.title, s: `in ${topic.label}`, u: `${topicHref(topic.slug)}#${sec.id}`, d: "", h: [], x: sec.text });
    }
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
