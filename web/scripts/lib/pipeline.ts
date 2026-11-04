// One outlet's daily processing, shared by `npm run collect` (all outlets, saved)
// and `npm run check-outlet` (one outlet, printed only), so a check always shows
// exactly what the real collection would do.
//
// feed (RSS/Atom or news sitemap) -> outlet rules -> freshness -> article page
// (paywall check, OGP image) -> AI scoring & place -> coordinate check -> photo check
// -> free-license place photo

import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { insideCountry, type CountryCode } from "../../src/lib/countries";
import type { Outlet } from "../../src/lib/outlets";
import type { Article, ArticleImage, Place } from "../../src/lib/types";
import { checkRobots } from "./robots";

const MODEL = "claude-haiku-5-5";
const MAX_AGE_HOURS = 48;
const MAX_PER_OUTLET = 30;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export type RawItem = {
  title: string;
  description: string;
  url: string;
  publishedAt: string | null;
  feedImage: string | null;
};

/** What happened to one outlet in one run. Saved to data/health.json by the collector. */
export type OutletReport = {
  id: string;
  name: string;
  country: string;
  ok: boolean; // false if no feed could be read at all
  feedItems: number;
  afterRules: number; // after outlet rules, de-duplication and the freshness window
  paywalled: number;
  scored: boolean; // false when there is no API key or scoring failed
  rejectedByAi: number; // not domestic news, or interest 1
  placeFromAi: number;
  placeRejected: number; // AI coordinates outside the country: fell back to the outlet base
  photos: number; // articles with a usable OGP photo
  kept: number;
  // robots.txt of the feed's site and the articles' sites. Anything but "ok" skips the outlet
  // for this run, before its pages are fetched (decisions.md, 2026-11-04).
  robots: "ok" | "blocked" | "unknown";
  robotsReasons: string[];
  errors: string[];
  ms: number;
};

// ---------- Feeds ----------

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

const text = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object" && "#text" in (v as object)) return text((v as { "#text": unknown })["#text"]);
  return "";
};

const asArray = <T>(x: T | T[] | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201c", rdquo: "\u201d",
  ndash: "\u2013", mdash: "\u2014", hellip: "\u2026",
};

const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);

// Removes tags and decodes character references: named ones (&amp;, &rsquo;),
// decimal (&#8217;) and hex (&#x2019;). WordPress feeds use the numeric forms a lot.
// Some feeds escape twice ("&amp;#8217;"), so decode a second time if anything is left.
export const stripHtml = (s: string) => {
  let out = decodeEntities(s.replace(/<[^>]*>/g, " "));
  if (/&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(out)) out = decodeEntities(out);
  return out.replace(/\s+/g, " ").trim();
};

// fetch(), but when a site says "too many requests" (429) or "try later" (503), wait and
// try once more. Honors a Retry-After of up to 10 seconds; otherwise waits 2 seconds.
async function politeFetch(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status !== 429 && res.status !== 503) return res;
  await res.body?.cancel();
  const retryAfter = Number(res.headers.get("retry-after"));
  const waitMs = retryAfter > 0 && retryAfter <= 10 ? retryAfter * 1000 : 2000;
  await new Promise((r) => setTimeout(r, waitMs));
  return fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
}

// Decodes a response using the charset it declares (HTTP header, XML declaration or
// <meta charset>), so feeds in EUC-KR, GBK, Shift_JIS, Windows-1251 etc. aren't garbled.
async function readText(res: Response): Promise<string> {
  const bytes = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 2048));
  const declared =
    /charset=["']?([\w-]+)/i.exec(res.headers.get("content-type") ?? "")?.[1] ??
    /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(declared.toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes); // unknown label: fall back to UTF-8
  }
}

const isoDate = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function itemImage(item: Record<string, unknown>): string | null {
  const media = item["media:content"] ?? item["media:thumbnail"] ?? item["enclosure"];
  const first = Array.isArray(media) ? media[0] : media;
  return first && typeof first === "object" ? ((first as Record<string, string>)["@_url"] ?? null) : null;
}

// Looks up an XML child by its local name, whatever namespace prefix the site chose:
// "news:title", "n:title" and plain "title" all match "title". (In XML the prefix is
// just a nickname declared at the top of the file; the meaning comes from the URI.)
export function byLocalName(node: unknown, localName: string): unknown {
  if (!node || typeof node !== "object") return undefined;
  const key = Object.keys(node).find((k) => k === localName || k.endsWith(`:${localName}`));
  return key ? (node as Record<string, unknown>)[key] : undefined;
}

// Reads RSS 2.0, RDF, Atom, or a Google-News sitemap (<urlset> with <news:news>).
export async function fetchFeed(feedUrl: string): Promise<RawItem[]> {
  const res = await politeFetch(feedUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${feedUrl}: HTTP ${res.status}`);
  const doc = xml.parse(await readText(res));

  if (doc?.urlset) {
    return asArray<Record<string, unknown>>(doc.urlset.url).flatMap((entry) => {
      const news = byLocalName(entry, "news") as Record<string, unknown> | undefined;
      const title = stripHtml(text(byLocalName(news, "title")));
      if (!title) return []; // not a news entry
      const image = byLocalName(entry, "image") as Record<string, unknown> | undefined;
      return [
        {
          title,
          description: "", // sitemaps have none; filled from the article page's og:description
          url: text(entry.loc).trim(),
          publishedAt: isoDate(text(byLocalName(news, "publication_date")) || text(entry.lastmod)),
          feedImage: text(byLocalName(image, "loc")) || null,
        },
      ];
    });
  }

  const items = [doc?.rss?.channel?.item, doc?.["rdf:RDF"]?.item, doc?.feed?.entry].flatMap((x) =>
    asArray<Record<string, unknown>>(x),
  );
  if (items.length === 0 && !doc?.rss && !doc?.["rdf:RDF"] && !doc?.feed) {
    throw new Error(`${feedUrl}: not an RSS/Atom feed or news sitemap`);
  }
  return items.map((item) => {
    const link = item.link;
    const href =
      typeof link === "object" && link && !Array.isArray(link) && "@_href" in link
        ? String((link as Record<string, string>)["@_href"])
        : text(link) || text(item.guid);
    const date = text(item.pubDate) || text(item["dc:date"]) || text(item.published) || text(item.updated);
    return {
      title: stripHtml(text(item.title)),
      description: stripHtml(text(item.description) || text(item.summary)).slice(0, 600),
      url: href.trim(),
      publishedAt: date ? isoDate(date) : null,
      feedImage: itemImage(item),
    };
  });
}

// Removes tracking parameters (utm_source=rss etc.) so the same article always has the
// same URL — article ids are made from the URL, and summaries are cached by id.
export function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) if (/^utm_/i.test(key)) u.searchParams.delete(key);
    return u.toString();
  } catch {
    return url;
  }
}

// The outlet's own rules from outlets.ts.
export function applyRules(outlet: Outlet, item: RawItem): RawItem | null {
  if (!item.title || !item.url) return null;
  item = { ...item, url: cleanUrl(item.url) };
  const { dropTitle, stripTitle, dropUrl } = outlet.rules;
  if (dropTitle?.test(item.title) || dropUrl?.test(item.url)) return null;
  return stripTitle ? { ...item, title: item.title.replace(stripTitle, "").trim() } : item;
}

// ---------- Article page: paywall check, OGP image, description ----------

type PageInfo = { finalUrl: string; ogImage: string | null; ogDescription: string | null; paywalled: boolean };

function meta(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i",
  );
  const m = html.match(re);
  return m ? (m[1] ?? m[2]).replace(/&amp;/g, "&") : null;
}

// Finds the article's lead photo: og:image / twitter:image first; if a site leaves those
// empty (some WordPress sites do), the JSON-LD "image", then the WordPress featured image
// (<img class="... wp-post-image ...">). Relative URLs are resolved against the page.
export function pageImage(html: string, pageUrl: string, photoAfter?: string): string | null {
  const absolute = (u: string | null | undefined) => {
    if (!u || !u.trim()) return null;
    try {
      return new URL(u.replace(/&amp;/g, "&").trim(), pageUrl).toString();
    } catch {
      return null;
    }
  };

  const og = absolute(meta(html, "og:image") ?? meta(html, "twitter:image"));
  if (og) return og;

  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const found = absolute(firstImage(JSON.parse(m[1])));
      if (found) return found;
    } catch {
      // malformed JSON-LD: ignore
    }
  }

  const srcOf = (tag: string | undefined) => (tag ? absolute(/\b(?:data-src|src)=["']([^"']+)["']/i.exec(tag)?.[1]) : null);
  const featured = srcOf(/<img\b[^>]*\bwp-post-image\b[^>]*>/i.exec(html)?.[0]);
  if (featured) return featured;

  // Outlet rule: the first image after a marker such as the article body's class name.
  if (photoAfter) {
    const at = html.indexOf(photoAfter);
    if (at >= 0) return srcOf(/<img\b[^>]*>/i.exec(html.slice(at))?.[0]);
  }
  return null;
}

// The first "image" value anywhere in a JSON-LD tree: a URL string, {url}, or a list of either.
function firstImage(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = firstImage(n);
      if (f) return f;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const img = obj.image;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) {
    const first = img[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && typeof (first as { url?: unknown }).url === "string") return (first as { url: string }).url;
  }
  if (img && typeof img === "object" && typeof (img as { url?: unknown }).url === "string") return (img as { url: string }).url;
  for (const v of Object.values(obj)) {
    const f = firstImage(v);
    if (f) return f;
  }
  return null;
}

// Paywall markers found in article pages: schema.org's isAccessibleForFree=false (most
// common), the "content_tier" meta, and Arena Holdings' "articleAccessMode":"subscription"
// (Daily Dispatch, South Africa — missed until 2026-11-04).
export function isPaywalled(html: string): boolean {
  return (
    /"isAccessibleForFree"\s*:\s*"?false"?/i.test(html) ||
    /content=["'](locked|metered)["'][^>]*content_tier|content_tier["'][^>]*content=["'](locked|metered)/i.test(html) ||
    /"articleAccessMode"\s*:\s*"subscription"/i.test(html)
  );
}

async function fetchPage(url: string, photoAfter?: string): Promise<PageInfo | null> {
  try {
    const res = await politeFetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const html = (await readText(res)).slice(0, 400_000);
    // schema.org's isAccessibleForFree=false is the most widely used paywall marker.
    const paywalled = isPaywalled(html);
    const ogImage = pageImage(html, res.url, photoAfter);
    const ogDescription = meta(html, "og:description") ?? meta(html, "description");
    return { finalUrl: res.url, ogImage, ogDescription: ogDescription ? stripHtml(ogDescription) : null, paywalled };
  } catch {
    return null;
  }
}

// A site-wide placeholder judged by its file name ("logo.png", "og-default.jpg",
// "ht-generic_india1.jpg"…). A name starting with a long number is a per-article
// photo even if it contains such a word: newsvl.ru names real photos "12345_default.jpg".
// IIIF image servers (CBC and many archives) end every URL in ".../<size>/<rotation>/default.jpg",
// where "default" means default quality, not a default image.
export function looksLikePlaceholder(imageUrl: string): boolean {
  const path = new URL(imageUrl).pathname;
  if (/\/(full|square|\d+,\d+,\d+,\d+)\/[^/]+\/!?\d+\/default\.\w+$/i.test(path)) return false;
  const name = path.split("/").pop() ?? "";
  // A name starting with a long number or a UUID is a per-article photo
  // (newsvl.ru "12345_default.jpg"; Bitban CMS "<uuid>_facebook-aspect-ratio_default_0.jpg").
  if (/^(\d{4,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.test(name)) return false;
  return /logo|generic|default|placeholder|noimage/i.test(name);
}

// Requests the image the way the card will (no Referer) and checks it is really an image.
// Only the response headers are read; the body is discarded.
async function imageReachable(url: string): Promise<boolean> {
  try {
    const res = await politeFetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    // Some CDNs send a doubled header such as "application/octet-stream, image/webp";
    // browsers sniff those fine, so look for "image/" anywhere in it.
    const ok = res.ok && (res.headers.get("content-type") ?? "").includes("image/");
    await res.body?.cancel();
    return ok;
  } catch {
    return false;
  }
}

/** Runs `fn` over `items` with at most `limit` running at once, keeping the order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// ---------- AI scoring ----------

const Judgement = z.object({
  items: z.array(
    z.object({
      index: z.number().int(),
      local: z.boolean().describe("true if the story is about this country itself, not foreign news"),
      interest: z.number().int().min(1).max(5).describe("how interesting / distinctive this is for a curious reader abroad"),
      place_known: z.boolean().describe("true if the headline or description names where in the country it happens"),
      city_en: z.string().describe("city or town in English; empty if unknown"),
      region_en: z.string().describe("state / prefecture in English; empty if unknown"),
      city_ja: z.string().describe("the same city name in Japanese script (katakana, or kanji for Chinese/Japanese/Korean place names); empty if unknown"),
      lat: z.number(),
      lng: z.number(),
    }),
  ),
});
type Judged = z.infer<typeof Judgement>["items"][number];

const SCORER_SYSTEM = `You curate a "news letter from somewhere on Earth" service.
For each headline from a local news outlet, judge:
- local: is it about this country (domestic news)? Foreign or international news is false, even if written by a local outlet.
- interest (1-5): would a curious reader abroad enjoy getting this as a letter? Distinctive local life, culture, nature, odd or human stories and important local events score high. Routine stock moves, sports scores, horoscopes, generic wire stories and listicles score low.
- the place where the story happens, as precisely as the text allows (city or town). If the text does not say where, set place_known false and use the outlet's base city.
Return one entry per input index.`;

async function judge(client: Anthropic, outlet: Outlet, items: RawItem[]): Promise<Judged[] | null> {
  const list = items.map((it, i) => `[${i}] ${it.title}\n${it.description.slice(0, 280)}`).join("\n\n");
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SCORER_SYSTEM,
    messages: [{ role: "user", content: `Outlet: ${outlet.name} (${outlet.baseCity}, ${outlet.country})\n\n${list}` }],
    output_config: { format: zodOutputFormat(Judgement) },
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return response.parsed_output.items;
}

// ---------- Fallback photo (free license) ----------

const WIKI_UA = { "User-Agent": "NewsGardenPrototype/0.1 (local prototype)" };
// Licenses we accept for the fallback photo. Anything else (including Wikipedia's
// local "fair use" uploads, which never live under /wikipedia/commons/) is skipped.
const FREE_LICENSE = /^(cc0|cc by(-sa)? [\d.]+|public domain|pd\b|attribution)/i;

const photoCache = new Map<string, Promise<ArticleImage | null>>();

// Commons' author field is HTML that may contain encoded angle brackets; drop them.
const stripTags = (html: string) => stripHtml(html).replace(/[<>]/g, "").trim();

// Looks up a Commons file's license and author. Returns null unless it's freely licensed.
async function commonsImage(originalUrl: string): Promise<ArticleImage | null> {
  const path = new URL(originalUrl).pathname;
  if (!path.startsWith("/wikipedia/commons/")) return null;
  // Original: /wikipedia/commons/a/a3/Name.jpg
  // Thumbnail: /wikipedia/commons/thumb/a/a3/Name.jpg/3840px-Name.jpg
  const parts = path.split("/");
  const thumb = parts.indexOf("thumb");
  const fileName = decodeURIComponent(thumb >= 0 ? parts[thumb + 3] : parts[parts.length - 1]);
  const api =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo" +
    `&iiprop=extmetadata|url&iiurlwidth=1280&titles=${encodeURIComponent(`File:${fileName}`)}`;
  const res = await fetch(api, { headers: WIKI_UA, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url: string; descriptionurl?: string; extmetadata?: Record<string, { value: string }> }[] }> };
  };
  const info = Object.values(data.query?.pages ?? {})[0]?.imageinfo?.[0];
  const m = info?.extmetadata ?? {};
  const license = m.LicenseShortName?.value ?? "";
  if (!info || m.NonFree?.value === "true" || !FREE_LICENSE.test(license)) return null;
  const artist = stripTags(m.Artist?.value ?? "")
    // Commons' wording when the author field is missing: "No machine-readable author provided. X assumed (based on ...)"
    .replace(/^No machine-readable author provided\.\s*(.+?)\s+assumed.*$/i, "$1");
  const author = artist.slice(0, 60) || "Wikimedia Commons";
  return {
    url: info.thumburl ?? info.url,
    source: "fallback",
    author,
    license,
    licenseUrl: m.LicenseUrl?.value,
    credit: `${author} / ${license}`,
    creditUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`,
  };
}

async function findPlacePhoto(place: Place, country: string): Promise<ArticleImage | null> {
  const titles = [place.region ? `${place.city}, ${place.region}` : null, place.city, country].filter(Boolean) as string[];
  for (const title of titles) {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        headers: WIKI_UA,
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const page = (await res.json()) as { type?: string; originalimage?: { source: string } };
      if (page.type === "disambiguation" || !page.originalimage) continue;
      const found = await commonsImage(page.originalimage.source);
      if (found) return found;
    } catch {
      // try the next title
    }
  }
  return null;
}

// Cached as a promise, so outlets processed at the same time share one lookup per place.
function placePhoto(place: Place, country: string): Promise<ArticleImage | null> {
  const key = `${place.city}|${place.region ?? ""}|${country}`;
  if (!photoCache.has(key)) photoCache.set(key, findPlacePhoto(place, country));
  return photoCache.get(key)!;
}

/**
 * True if `name` is written only in Japanese script (kana, kanji). The AI sometimes puts
 * the local spelling in the Japanese field (اسلام آباد, 순천…); those are dropped and the
 * card falls back to the English name.
 */
export function isJapaneseScript(name: string): boolean {
  return /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー・\s]+$/u.test(name.trim());
}

// ---------- One outlet ----------

const idFor = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 12);

export async function processOutlet(
  outlet: Outlet,
  client: Anthropic | null,
): Promise<{ articles: Article[]; report: OutletReport }> {
  const started = Date.now();
  const report: OutletReport = {
    id: outlet.id,
    name: outlet.name,
    country: outlet.country,
    ok: false,
    feedItems: 0,
    afterRules: 0,
    paywalled: 0,
    scored: false,
    rejectedByAi: 0,
    placeFromAi: 0,
    placeRejected: 0,
    photos: 0,
    kept: 0,
    robots: "ok",
    robotsReasons: [],
    errors: [],
    ms: 0,
  };
  const articles: Article[] = [];
  const finish = () => {
    report.ms = Date.now() - started;
    return { articles, report };
  };

  try {
    // Stops the outlet if a site involved turns away Anthropic's crawlers or all bots, or
    // its robots.txt can't be read. Checked before anything is fetched from that site.
    const robotsAllow = async (urls: string[]) => {
      const v = await checkRobots(urls);
      if (v.blocking.length === 0 && v.unknown.length === 0) return true;
      report.robots = v.blocking.length ? "blocked" : "unknown";
      report.robotsReasons = [...v.blocking, ...v.unknown];
      report.errors.push(`skipped by robots.txt: ${report.robotsReasons.join("; ")}`);
      return false;
    };

    // 0. The feeds' sites must allow us.
    if (!(await robotsAllow(outlet.feeds))) return finish();

    // 1. Feeds. One broken feed doesn't stop the others.
    const results = await Promise.allSettled(outlet.feeds.map(fetchFeed));
    const raw: RawItem[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") raw.push(...r.value);
      else report.errors.push(String((r.reason as Error).message ?? r.reason));
    }
    report.ok = results.some((r) => r.status === "fulfilled");
    report.feedItems = raw.length;

    // 2. Outlet rules, de-duplication, freshness, newest first.
    const cutoff = Date.now() - MAX_AGE_HOURS * 3600_000;
    const seen = new Set<string>();
    const fresh = raw
      .map((it) => applyRules(outlet, it))
      .filter((it): it is RawItem => !!it)
      .filter((it) => (seen.has(it.url) ? false : (seen.add(it.url), true)))
      .filter((it) => !it.publishedAt || Date.parse(it.publishedAt) >= cutoff)
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(0, MAX_PER_OUTLET);
    report.afterRules = fresh.length;

    // 2b. The sites the articles live on must allow us too (they can differ from the feed's:
    // BBC feeds are on feeds.bbci.co.uk, its articles on www.bbc.co.uk).
    if (!(await robotsAllow(fresh.map((it) => it.url)))) return finish();

    // 3. Article pages: drop paywalled ones; fill missing descriptions (sitemaps have none).
    const pages = await mapLimit(fresh, 6, (it) => fetchPage(it.url, outlet.rules.photoAfter));
    const open = fresh
      .map((it, i) => ({ it: { ...it, description: it.description || pages[i]?.ogDescription || "" }, page: pages[i] }))
      .filter(({ page }) => !page?.paywalled);
    report.paywalled = fresh.length - open.length;

    // 4. AI: domestic or not, how interesting, and where.
    let judgements: Judged[] | null = null;
    if (client && open.length) {
      try {
        judgements = await judge(client, outlet, open.map((o) => o.it));
        if (!judgements) report.errors.push("scoring returned no result");
      } catch (e) {
        report.errors.push(`scoring failed: ${(e as Error).message}`);
      }
    }
    report.scored = !!judgements;

    // 5. Photos. An OGP image shared by several articles, or named like a logo, is a
    // site-wide placeholder rather than a photo of the story.
    const imageUse = new Map<string, number>();
    for (const { it, page } of open) {
      const u = page?.ogImage ?? it.feedImage;
      if (u) imageUse.set(u, (imageUse.get(u) ?? 0) + 1);
    }
    const isGeneric = (u: string) => (imageUse.get(u) ?? 0) >= 3 || looksLikePlaceholder(u);
    const candidates = open.map(({ it, page }) => {
      const u = page?.ogImage ?? it.feedImage;
      return u && !isGeneric(u) ? u : null;
    });
    const reachable = await mapLimit(candidates, 6, (u) => (u ? imageReachable(u) : Promise.resolve(false)));

    // 6. Assemble.
    for (const [i, { it, page }] of open.entries()) {
      const j = judgements?.find((x) => x.index === i);
      if (judgements && (!j || !j.local || j.interest < 2)) {
        report.rejectedByAi++;
        continue;
      }

      let place: Place = { city: outlet.baseCity, lat: outlet.baseLat, lng: outlet.baseLng, source: "outlet" };
      if (j && j.place_known && j.city_en) {
        // Guard against AI slips (swapped lat/lng, a same-named city abroad).
        if (insideCountry(outlet.countryCode as CountryCode, j.lat, j.lng)) {
          place = {
            city: j.city_en,
            region: j.region_en || undefined,
            names: { en: j.city_en, ...(isJapaneseScript(j.city_ja) ? { ja: j.city_ja } : {}) },
            lat: j.lat,
            lng: j.lng,
            source: "ai",
          };
          report.placeFromAi++;
        } else {
          report.placeRejected++;
          report.errors.push(`coordinates outside ${outlet.country} for "${it.title.slice(0, 40)}": ${j.lat}, ${j.lng} (${j.city_en})`);
        }
      }

      const ogp = reachable[i] ? candidates[i] : null;
      if (ogp) report.photos++;
      articles.push({
        id: idFor(it.url),
        outletId: outlet.id,
        outletName: outlet.name,
        country: outlet.country,
        countryCode: outlet.countryCode,
        lang: outlet.lang,
        title: it.title,
        description: it.description,
        url: page?.finalUrl ?? it.url,
        publishedAt: it.publishedAt,
        image: ogp ? { url: ogp, source: "ogp" } : null,
        fallbackImage: await placePhoto(place, outlet.country),
        place,
        score: j?.interest ?? 3,
      });
    }
    report.kept = articles.length;
  } catch (e) {
    report.errors.push(`unexpected: ${(e as Error).message}`);
  }

  return finish();
}
