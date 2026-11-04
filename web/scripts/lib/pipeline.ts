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

const MODEL = "claude-haiku-5-5";
const MAX_AGE_HOURS = 48;
const MAX_PER_OUTLET = 30;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

type RawItem = {
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

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const isoDate = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function itemImage(item: Record<string, unknown>): string | null {
  const media = item["media:content"] ?? item["media:thumbnail"] ?? item["enclosure"];
  const first = Array.isArray(media) ? media[0] : media;
  return first && typeof first === "object" ? ((first as Record<string, string>)["@_url"] ?? null) : null;
}

// Reads RSS 2.0, RDF, Atom, or a Google-News sitemap (<urlset> with <news:news>).
async function fetchFeed(feedUrl: string): Promise<RawItem[]> {
  const res = await fetch(feedUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${feedUrl}: HTTP ${res.status}`);
  const doc = xml.parse(await res.text());

  if (doc?.urlset) {
    return asArray<Record<string, unknown>>(doc.urlset.url).flatMap((entry) => {
      const news = entry["news:news"] as Record<string, unknown> | undefined;
      const title = stripHtml(text(news?.["news:title"]));
      if (!title) return []; // not a news entry
      const image = entry["image:image"] as Record<string, unknown> | undefined;
      return [
        {
          title,
          description: "", // sitemaps have none; filled from the article page's og:description
          url: text(entry.loc).trim(),
          publishedAt: isoDate(text(news?.["news:publication_date"]) || text(entry.lastmod)),
          feedImage: text(image?.["image:loc"]) || null,
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

// The outlet's own rules from outlets.ts.
function applyRules(outlet: Outlet, item: RawItem): RawItem | null {
  if (!item.title || !item.url) return null;
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

async function fetchPage(url: string): Promise<PageInfo | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 400_000);
    // schema.org's isAccessibleForFree=false is the most widely used paywall marker.
    const paywalled =
      /"isAccessibleForFree"\s*:\s*"?false"?/i.test(html) ||
      /content=["'](locked|metered)["'][^>]*content_tier|content_tier["'][^>]*content=["'](locked|metered)/i.test(html);
    let ogImage = meta(html, "og:image") ?? meta(html, "twitter:image");
    if (ogImage && ogImage.startsWith("/")) ogImage = new URL(ogImage, res.url).toString();
    const ogDescription = meta(html, "og:description") ?? meta(html, "description");
    return { finalUrl: res.url, ogImage, ogDescription: ogDescription ? stripHtml(ogDescription) : null, paywalled };
  } catch {
    return null;
  }
}

// Requests the image the way the card will (no Referer) and checks it is really an image.
// Only the response headers are read; the body is discarded.
async function imageReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
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
      city_ja: z.string().describe("the same city name written in Japanese; empty if unknown"),
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

const stripTags = (html: string) =>
  stripHtml(html)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;|&gt;/g, "")
    .trim();

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
    errors: [],
    ms: 0,
  };
  const articles: Article[] = [];

  try {
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

    // 3. Article pages: drop paywalled ones; fill missing descriptions (sitemaps have none).
    const pages = await mapLimit(fresh, 6, (it) => fetchPage(it.url));
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
    const isGeneric = (u: string) =>
      (imageUse.get(u) ?? 0) >= 3 || /(logo|generic|default|placeholder|noimage)[^/]*$/i.test(new URL(u).pathname);
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
            names: { en: j.city_en, ...(j.city_ja ? { ja: j.city_ja } : {}) },
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

  report.ms = Date.now() - started;
  return { articles, report };
}
