// Daily collector: RSS -> filter paywalls -> OGP image -> AI scoring & place -> data/articles.json
// Run with `npm run collect`. Without ANTHROPIC_API_KEY it still works, but every
// article is kept with a neutral score and pinned to its outlet's base city.

import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { OUTLETS } from "../src/lib/outlets";
import { saveArticles } from "../src/lib/store";
import type { Article, ArticleImage, Outlet, Place } from "../src/lib/types";

const MODEL = "claude-haiku-5-5";
const MAX_AGE_HOURS = 48;
const MAX_PER_OUTLET = 30;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

type RawItem = {
  outlet: Outlet;
  title: string;
  description: string;
  url: string;
  publishedAt: string | null;
  feedImage: string | null;
};

// ---------- RSS ----------

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });

const text = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object" && "#text" in (v as object)) return text((v as { "#text": unknown })["#text"]);
  return "";
};

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

function itemImage(item: Record<string, unknown>): string | null {
  const media = item["media:content"] ?? item["media:thumbnail"] ?? item["enclosure"];
  const first = Array.isArray(media) ? media[0] : media;
  const url = first && typeof first === "object" ? (first as Record<string, string>)["@_url"] : null;
  return url && /\.(jpe?g|png|webp)/i.test(url) ? url : url ?? null;
}

async function fetchFeed(outlet: Outlet, feedUrl: string): Promise<RawItem[]> {
  const res = await fetch(feedUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${feedUrl}: HTTP ${res.status}`);
  const doc = xml.parse(await res.text());
  const items: Record<string, unknown>[] = [doc?.rss?.channel?.item, doc?.["rdf:RDF"]?.item, doc?.feed?.entry]
    .filter(Boolean)
    .flatMap((x) => (Array.isArray(x) ? x : [x]));

  return items.map((item) => {
    const link = item.link;
    const href =
      typeof link === "object" && link && !Array.isArray(link) && "@_href" in link
        ? String((link as Record<string, string>)["@_href"])
        : text(link) || text(item.guid);
    const date = text(item.pubDate) || text(item["dc:date"]) || text(item.published) || text(item.updated);
    return {
      outlet,
      title: stripHtml(text(item.title)),
      description: stripHtml(text(item.description) || text(item.summary)).slice(0, 600),
      url: href.trim(),
      publishedAt: date ? new Date(date).toISOString() : null,
      feedImage: itemImage(item),
    };
  });
}

// Outlet-specific clean-up and paywall rules visible in the feed itself.
function cleanAndFilter(item: RawItem): RawItem | null {
  if (!item.title || !item.url) return null;
  switch (item.outlet.id) {
    case "okinawatimes":
      // "... - 沖縄タイムス＋プラス　プレミアム" marks members-only articles.
      if (/プレミアム\s*$/.test(item.title)) return null;
      return { ...item, title: item.title.replace(/\s*-\s*沖縄タイムス＋プラス.*$/, "") };
    case "amarujala":
      if (item.url.includes("/live/")) return null; // live blogs make poor letters
      return item;
    default:
      return item;
  }
}

// ---------- Article page: OGP image + paywall check ----------

type PageInfo = { finalUrl: string; ogImage: string | null; paywalled: boolean };

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
      /"isAccessibleForFree"\s*:\s*"?false"?/i.test(html) || /content=["'](locked|metered)["'][^>]*content_tier|content_tier["'][^>]*content=["'](locked|metered)/i.test(html);
    let ogImage = meta(html, "og:image") ?? meta(html, "twitter:image");
    if (ogImage && ogImage.startsWith("/")) ogImage = new URL(ogImage, res.url).toString();
    return { finalUrl: res.url, ogImage, paywalled };
  } catch {
    return null;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
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

const SCORER_SYSTEM = `You curate a "news letter from somewhere on Earth" service.
For each headline from a local news outlet, judge:
- local: is it about this country (domestic news)? Foreign or international news is false, even if written by a local outlet.
- interest (1-5): would a curious reader abroad enjoy getting this as a letter? Distinctive local life, culture, nature, odd or human stories and important local events score high. Routine stock moves, sports scores, horoscopes, generic wire stories and listicles score low.
- the place where the story happens, as precisely as the text allows (city or town). If the text does not say where, set place_known false and use the outlet's base city.
Return one entry per input index.`;

async function judge(client: Anthropic, outlet: Outlet, items: RawItem[]) {
  const list = items
    .map((it, i) => `[${i}] ${it.title}\n${it.description.slice(0, 280)}`)
    .join("\n\n");
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SCORER_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Outlet: ${outlet.name} (${outlet.baseCity}, ${outlet.country})\n\n${list}`,
      },
    ],
    output_config: { format: zodOutputFormat(Judgement) },
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    console.warn(`  ! scoring returned no result for ${outlet.id} (${response.stop_reason})`);
    return null;
  }
  return response.parsed_output.items;
}

// ---------- Fallback photo (free license) ----------

const photoCache = new Map<string, ArticleImage | null>();

async function placePhoto(place: Place, country: string): Promise<ArticleImage | null> {
  const key = `${place.city}|${place.region ?? ""}|${country}`;
  if (photoCache.has(key)) return photoCache.get(key)!;
  const titles = [place.region ? `${place.city}, ${place.region}` : null, place.city, country].filter(Boolean) as string[];
  let found: ArticleImage | null = null;
  for (const title of titles) {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        headers: { "User-Agent": "NewsGardenPrototype/0.1 (local prototype)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const page = (await res.json()) as {
        type?: string;
        thumbnail?: { source: string };
        originalimage?: { source: string; width: number };
        content_urls?: { desktop?: { page?: string } };
      };
      if (page.type === "disambiguation") continue;
      // The summary thumbnail is ~330px wide; ask Wikimedia for a 1280px rendition instead.
      const src =
        page.originalimage && page.originalimage.width <= 1600
          ? page.originalimage.source
          : page.thumbnail?.source.replace(/\/\d+px-/, "/1280px-");
      if (!src) continue;
      found = { url: src, source: "fallback", credit: "Wikimedia Commons", creditUrl: page.content_urls?.desktop?.page };
      break;
    } catch {
      // try the next title
    }
  }
  photoCache.set(key, found);
  return found;
}

// ---------- main ----------

const idFor = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 12);

async function main() {
  const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  if (!client) console.warn("ANTHROPIC_API_KEY is not set: skipping AI scoring (all articles kept, pinned to outlet city).");
  const cutoff = Date.now() - MAX_AGE_HOURS * 3600_000;
  const articles: Article[] = [];

  for (const outlet of OUTLETS) {
    console.log(`\n${outlet.name}`);
    const raw = (
      await Promise.all(
        outlet.feeds.map((f) =>
          fetchFeed(outlet, f).catch((e) => {
            console.warn(`  ! ${e.message}`);
            return [] as RawItem[];
          }),
        ),
      )
    ).flat();

    const seen = new Set<string>();
    const fresh = raw
      .map(cleanAndFilter)
      .filter((it): it is RawItem => !!it)
      .filter((it) => (seen.has(it.url) ? false : (seen.add(it.url), true)))
      .filter((it) => !it.publishedAt || Date.parse(it.publishedAt) >= cutoff)
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(0, MAX_PER_OUTLET);
    console.log(`  feed items: ${raw.length}, after filters: ${fresh.length}`);

    const pages = await mapLimit(fresh, 6, (it) => fetchPage(it.url));
    const open = fresh
      .map((it, i) => ({ it, page: pages[i] }))
      .filter(({ page }) => !page?.paywalled);
    console.log(`  paywalled (dropped): ${fresh.length - open.length}`);

    const judgements = client && open.length ? await judge(client, outlet, open.map((o) => o.it)) : null;

    // An OGP image shared by several articles, or named like a logo, is a site-wide
    // placeholder rather than a photo of the story: use the place photo instead.
    const imageUse = new Map<string, number>();
    for (const { it, page } of open) {
      const u = page?.ogImage ?? it.feedImage;
      if (u) imageUse.set(u, (imageUse.get(u) ?? 0) + 1);
    }
    const isGeneric = (u: string) =>
      (imageUse.get(u) ?? 0) >= 3 || /(logo|generic|default|placeholder|noimage)[^/]*$/i.test(new URL(u).pathname);

    let kept = 0;
    for (const [i, { it, page }] of open.entries()) {
      const j = judgements?.find((x) => x.index === i);
      if (judgements && (!j || !j.local || j.interest < 2)) continue;

      const place: Place =
        j && j.place_known && j.city_en
          ? {
              city: j.city_en,
              region: j.region_en || undefined,
              names: { en: j.city_en, ...(j.city_ja ? { ja: j.city_ja } : {}) },
              lat: j.lat,
              lng: j.lng,
              source: "ai",
            }
          : { city: outlet.baseCity, lat: outlet.baseLat, lng: outlet.baseLng, source: "outlet" };

      const candidate = page?.ogImage ?? it.feedImage;
      const ogp = candidate && !isGeneric(candidate) ? candidate : null;
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
      kept++;
    }
    console.log(`  kept: ${kept}`);
  }

  await saveArticles(articles);
  console.log(`\nSaved ${articles.length} articles to data/articles.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
