// Reads links out of a mediator's message: copes with links glued to punctuation
// ("…/viewform." or "(…)") and links pasted without https://, and tells refund
// form links apart from product links. The message itself is never changed.
// No React, no '@/' imports, so it is unit tested with node --test.

export type MessageLinkKind = 'form' | 'product' | 'other';

export interface MessageLink {
  url: string; // always starts with http:// or https://
  kind: MessageLinkKind;
  label: string; // short text for display, e.g. "forms.gle/AbC123"
}

// Hosts that only ever serve forms.
const FORM_HOSTS = ['forms.gle', 'forms.office.com', 'forms.zohopublic.in', 'forms.zohopublic.com', 'tally.so', 'typeform.com', 'jotform.com', 'form.jotform.com'];
// Shopping sites and their short links.
const PRODUCT_HOSTS = [
  'amazon.in', 'amazon.com', 'amzn.to', 'amzn.in', 'amzn.eu', 'a.co',
  'flipkart.com', 'fkrt.it', 'fkrt.cc', 'dl.flipkart.com',
  'meesho.com', 'msho.in', 'myntra.com', 'myntr.it', 'ajio.com', 'ajiio.in',
  'nykaa.com', 'nykaafashion.com', 'shopsy.in', 'jiomart.com', 'blinkit.com', 'snapdeal.com', 'tatacliq.com',
];
// Domains recognised even when typed without http(s)://
const BARE_HOSTS = ['forms.gle', 'docs.google.com', 'amzn.to', 'amzn.in', 'fkrt.it', 'fkrt.cc', 'bit.ly', 'tinyurl.com', 'wa.me'];

const TRAILING_CHARS = `.,;:!?'"’”)]}>`;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function hostMatches(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith('.' + h));
}

export function classifyLink(url: string): MessageLinkKind {
  const host = hostOf(url);
  if (!host) return 'other';
  let path = '';
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    path = '';
  }
  if (hostMatches(host, FORM_HOSTS)) return 'form';
  if (host === 'docs.google.com' && path.startsWith('/forms')) return 'form';
  if (hostMatches(host, PRODUCT_HOSTS)) return 'product';
  if (/(^|\/)(forms?|refund|claim)(\/|$|-|_)/.test(path) || /refund|form/.test(host)) return 'form';
  return 'other';
}

/** Removes punctuation stuck to the end of a link, keeping a ")" that closes a "(" inside the link. */
function trimLink(raw: string): string {
  let url = raw;
  while (url && TRAILING_CHARS.includes(url[url.length - 1])) {
    const last = url[url.length - 1];
    if (last === ')' && count(url, '(') >= count(url, ')')) break;
    url = url.slice(0, -1);
  }
  return url;
}

function count(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

function shortLabel(url: string): string {
  const s = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  return s.length > 42 ? `${s.slice(0, 40)}…` : s;
}

/** Every distinct link in the message, in the order they appear. */
export function extractLinks(message: string | null | undefined): MessageLink[] {
  if (!message) return [];
  const bare = BARE_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|');
  const re = new RegExp(`(https?:\\/\\/[^\\s<>"]+)|(?:^|[\\s(\\[<"'])((?:www\\.)?(?:${bare})\\/[^\\s<>"]*)`, 'gi');
  const seen = new Set<string>();
  const out: MessageLink[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(message))) {
    let url = trimLink(m[1] || m[2] || '');
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    if (!hostOf(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, kind: classifyLink(url), label: shortLabel(url) });
  }
  return out;
}

export interface MessageView {
  /** Link for the card's "Refund form" button: the saved link, else the only form link in the message. */
  formUrl: string | null;
  links: MessageLink[];
  /** True when there is something in the message beyond the refund form link itself. */
  hasMore: boolean;
}

export function messageView(message: string | null | undefined, savedFormLink: string | null | undefined, isSafe: (u: string) => boolean): MessageView {
  const links = extractLinks(message).filter((l) => isSafe(l.url));
  const forms = links.filter((l) => l.kind === 'form');
  const saved = savedFormLink && isSafe(savedFormLink) ? savedFormLink : null;
  const text = (message || '').trim();
  // A message that is just one link was always treated as the refund form; keep
  // that for short links (bit.ly etc.), but never for a shopping link.
  const single = links.length === 1 && trimLink(text).replace(/^https?:\/\//i, '').toLowerCase() === links[0].url.replace(/^https?:\/\//i, '').toLowerCase();
  const formUrl = saved || (forms.length === 1 ? forms[0].url : single && links[0].kind !== 'product' ? links[0].url : null);
  // A message that is nothing but the refund form link adds nothing to show.
  const onlyFormLink = single && formUrl === links[0].url;
  return { formUrl, links, hasMore: text.length > 0 && !onlyFormLink };
}
