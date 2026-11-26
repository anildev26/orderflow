// Text matching for the Feature Requests page: finds requests similar to what a user
// is typing, and existing features that already do it. Pure functions, no I/O, so the
// same logic runs while typing and in admin triage, and is unit tested.

import { FEATURE_CATALOG, type CatalogFeature } from './featureCatalog.ts';

/** Words that carry no meaning for matching. */
const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'at', 'for', 'from', 'by', 'with', 'without',
  'is', 'are', 'was', 'be', 'been', 'it', 'its', 'this', 'that', 'these', 'those', 'there', 'here',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their',
  'can', 'could', 'would', 'should', 'will', 'shall', 'may', 'might', 'must', 'do', 'does', 'did',
  'have', 'has', 'had', 'get', 'got', 'please', 'pls', 'plz', 'kindly', 'want', 'wanted', 'need', 'needs',
  'like', 'able', 'also', 'so', 'if', 'when', 'then', 'than', 'just', 'some', 'any', 'all', 'every',
  'each', 'more', 'very', 'too', 'not', 'no', 'yes', 'as', 'into', 'about', 'which', 'what', 'how', 'why',
  'where', 'who', 'feature', 'features', 'option', 'options', 'add', 'adding', 'new', 'make', 'allow',
  'let', 'us', 'way', 'using', 'use', 'app', 'website', 'orderflow', 'page', 'button', 'see', 'show',
  'thing', 'things', 'mode', 'one', 'two', 'per', 'via', 'etc', 'hi', 'hello', 'thanks', 'thank',
]);

/** Words that matter a little but appear everywhere in this app. */
const WEAK = new Set(['order', 'list', 'time', 'date', 'day', 'data', 'detail', 'details', 'status', 'update', 'view', 'screen']);

/** Groups of words people use for the same idea. Each word maps to its group's first word. */
const SYNONYM_GROUPS: string[][] = [
  ['followup', 'follow', 'chase', 'nudge'],
  ['remind', 'reminder', 'notify', 'notification', 'alert', 'alarm', 'ping'],
  ['export', 'download'],
  ['csv', 'excel', 'spreadsheet', 'xlsx', 'xls', 'sheet', 'sheets'],
  ['backup', 'restore', 'json'],
  ['import', 'upload'],
  ['theme', 'dark', 'light', 'night', 'darkmode', 'bright', 'brightness'],
  ['whatsapp', 'wa', 'whatsap', 'watsapp', 'whats'],
  ['mediator', 'agent', 'middleman', 'agency'],
  ['refund', 'cashback', 'repayment', 'reimburse'],
  ['payment', 'paid', 'pay', 'money', 'received'],
  ['analytics', 'chart', 'graph', 'stats', 'statistic', 'statistics', 'insight', 'insights', 'report', 'reports'],
  ['platform', 'marketplace', 'store', 'site', 'meesho', 'ajio', 'blinkit', 'shopsy', 'nykaa'],
  ['search', 'find', 'filter', 'lookup', 'sort'],
  ['copy', 'share', 'paste'],
  ['archive', 'archived', 'history', 'completed', 'finished'],
  ['review', 'rating', 'ratings'],
  ['telegram', 'tg', 'bot'],
  ['bulk', 'multiple', 'many', 'several', 'batch', 'mass', 'together', 'once'],
  ['autocomplete', 'autofill', 'suggest', 'suggestion', 'suggestions'],
  ['commission', 'commision', 'comission'],
  ['delete', 'remove', 'erase'],
  ['edit', 'change', 'modify'],
  ['phone', 'number', 'mobile'],
];

const CANON = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  for (const w of group) CANON.set(w, group[0]);
}

function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ied')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && /(sh|ch|x|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

function canonical(word: string): string {
  const direct = CANON.get(word);
  if (direct) return direct;
  const s = stem(word);
  return CANON.get(s) ?? s;
}

/** Lower-case words with joined phrases ("follow up" → "followup", "dark mode" → "darkmode"). */
function rawWords(text: string): string[] {
  const lowered = text
    .toLowerCase()
    .replace(/follow[\s-]+ups?\b/g, 'followup')
    .replace(/dark[\s-]+mode/g, 'darkmode')
    .replace(/what'?s\s*app/g, 'whatsapp')
    .replace(/auto[\s-]+(fill|complete)/g, 'auto$1')
    .replace(/[^a-z0-9ऀ-ॿ]+/g, ' ');
  return lowered.split(' ').filter(Boolean);
}

/** Meaningful canonical tokens of a text, in order, without duplicates. */
export function tokens(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of rawWords(text)) {
    if (w.length < 2 || STOP.has(w) || /^\d+$/.test(w)) continue;
    const c = canonical(w);
    if (STOP.has(c) || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

// How distinctive a word is across OrderFlow's features: "refund" appears in many,
// "theme" in one. Rare words decide the match; common ones only support it.
let DOC_FREQ: Map<string, number> | null = null;
function docFreq(): Map<string, number> {
  if (!DOC_FREQ) {
    DOC_FREQ = new Map();
    for (const f of FEATURE_CATALOG) {
      const all = new Set(tokens(`${f.name} ${f.keywords} ${f.description}`));
      for (const t of all) DOC_FREQ.set(t, (DOC_FREQ.get(t) ?? 0) + 1);
    }
  }
  return DOC_FREQ;
}

function isWeak(token: string): boolean {
  return WEAK.has(token);
}

function weight(token: string): number {
  const n = FEATURE_CATALOG.length;
  const idf = 1 + Math.log((n + 1) / ((docFreq().get(token) ?? 0) + 1));
  return idf * (isWeak(token) ? 0.25 : 1);
}

interface Doc {
  strong: Set<string>; // name / title
  normal: Set<string>; // keywords
  weak: Set<string>;   // description / details
}

function buildDoc(strong: string, normal: string, weak: string): Doc {
  return { strong: new Set(tokens(strong)), normal: new Set(tokens(normal)), weak: new Set(tokens(weak)) };
}

function prefixHit(t: string, set: Set<string>): boolean {
  if (t.length < 4) return false;
  for (const d of set) {
    if (d.length >= 4 && (d.startsWith(t) || t.startsWith(d))) return true;
  }
  return false;
}

function tokenHit(t: string, doc: Doc): number {
  if (doc.strong.has(t)) return 1;
  if (doc.normal.has(t)) return 0.9;
  if (doc.weak.has(t)) return 0.6;
  if (prefixHit(t, doc.strong) || prefixHit(t, doc.normal)) return 0.6;
  if (prefixHit(t, doc.weak)) return 0.35;
  return 0;
}

/**
 * 0..1: how much of the query the document covers, weighted. Needs at least one
 * meaningful (non-weak) word to match, so "order" alone never matches everything.
 */
function scoreDoc(queryTokens: string[], doc: Doc): number {
  if (!queryTokens.length) return 0;
  let total = 0;
  let got = 0;
  let strongHit = false;
  for (const t of queryTokens) {
    const w = weight(t);
    const h = tokenHit(t, doc);
    total += w;
    got += w * h;
    if (h >= 0.6 && !isWeak(t)) strongHit = true;
  }
  if (!strongHit || total === 0) return 0;
  return got / total;
}

/** True once the text is specific enough to look for matches. */
export function isQueryReady(text: string): boolean {
  const t = tokens(text);
  if (!t.length) return false;
  if (text.trim().length < 4) return false;
  return t.some((x) => !isWeak(x));
}

export interface MatchableRequest {
  id: string;
  title: string;
  details?: string | null;
  content?: string | null;
}

export interface ScoredMatch<T> {
  item: T;
  score: number;
}

export const REQUEST_MATCH_THRESHOLD = 0.5;
export const FEATURE_MATCH_THRESHOLD = 0.55;

/** Requests that look like the same ask, best first. */
export function findSimilarRequests<T extends MatchableRequest>(
  text: string,
  requests: readonly T[],
  options: { excludeId?: string; limit?: number; threshold?: number } = {},
): ScoredMatch<T>[] {
  const { excludeId, limit = 3, threshold = REQUEST_MATCH_THRESHOLD } = options;
  const q = tokens(text);
  if (!q.length) return [];
  const scored: ScoredMatch<T>[] = [];
  for (const r of requests) {
    if (excludeId && r.id === excludeId) continue;
    const body = [r.details ?? '', r.content && r.content !== r.title ? r.content : ''].join(' ');
    const s = scoreDoc(q, buildDoc(r.title, '', body));
    if (s >= threshold) scored.push({ item: r, score: s });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

const CATALOG_DOCS = new Map<string, Doc>();
function catalogDoc(f: CatalogFeature): Doc {
  let d = CATALOG_DOCS.get(f.id);
  if (!d) {
    d = buildDoc(f.name, f.keywords, f.description);
    CATALOG_DOCS.set(f.id, d);
  }
  return d;
}

/** Existing OrderFlow features that already do what the text asks for, best first. */
export function findExistingFeatures(
  text: string,
  options: { limit?: number; threshold?: number; catalog?: readonly CatalogFeature[] } = {},
): ScoredMatch<CatalogFeature>[] {
  const { limit = 2, threshold = FEATURE_MATCH_THRESHOLD, catalog = FEATURE_CATALOG } = options;
  const q = tokens(text);
  if (!q.length) return [];
  const scored: ScoredMatch<CatalogFeature>[] = [];
  for (const f of catalog) {
    const s = scoreDoc(q, catalogDoc(f));
    if (s >= threshold) scored.push({ item: f, score: s });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Simple search box filter: every meaningful word must appear somewhere (prefixes allowed). */
export function matchesSearch(query: string, haystack: string): boolean {
  const q = tokens(query);
  const lowered = query.trim().toLowerCase();
  if (!q.length) return lowered.length === 0 || haystack.toLowerCase().includes(lowered);
  const doc = buildDoc(haystack, '', '');
  return q.every((t) => doc.strong.has(t) || prefixHit(t, doc.strong));
}
