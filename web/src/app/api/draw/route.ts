import type { NextRequest } from "next/server";
import { loadArticles } from "@/lib/store";
import type { Article, DrawResult } from "@/lib/types";

// Draws one article in three steps, each deciding one thing:
//
//   1. country  — evenly, but not one of the countries just shown (no runs of the same country)
//   2. outlet   — weighted by √(number of articles): a busy outlet is a bit more likely
//                 than a quiet one, but nowhere near in proportion to its volume
//   3. article  — weighted by AI interest score²
//
// The AI score only acts inside an outlet, so it can't tilt which outlet or country appears.
export async function GET(req: NextRequest) {
  // Recently drawn article ids, newest first (sent by the browser).
  const recentIds = (req.nextUrl.searchParams.get("recent") ?? "").split(",").filter(Boolean);
  const all = await loadArticles();
  if (all.length === 0) {
    return Response.json({ error: "No articles collected yet. Run `npm run collect`." }, { status: 503 });
  }

  const recent = new Set(recentIds);
  const pool = all.filter((a) => !recent.has(a.id));
  const candidates = pool.length > 0 ? pool : all;

  // 1. Country
  const byCountry = groupBy(candidates, (a) => a.countryCode);
  const countries = [...byCountry.keys()];
  const avoid = new Set(recentCountries(recentIds, all, Math.max(1, Math.floor((countries.length - 1) / 3))));
  const eligible = countries.filter((c) => !avoid.has(c));
  const choices = eligible.length > 0 ? eligible : countries;
  const country = choices[Math.floor(Math.random() * choices.length)];

  // 2. Outlet
  const byOutlet = groupBy(byCountry.get(country)!, (a) => a.outletId);
  const outletId = weightedPick([...byOutlet.keys()], (id) => Math.sqrt(byOutlet.get(id)!.length));

  // 3. Article
  const article = weightedPick(byOutlet.get(outletId)!, (a) => a.score * a.score);

  const result: DrawResult = {
    id: article.id,
    outletName: article.outletName,
    country: article.country,
    countryCode: article.countryCode,
    lang: article.lang,
    title: article.title,
    url: article.url,
    image: article.image,
    fallbackImage: article.fallbackImage,
    place: article.place,
  };
  return Response.json(result);
}

// The countries of the last `n` draws. With 3 countries that's just the previous one;
// with 15 it's the last 4, so the same few countries can't keep coming back.
function recentCountries(recentIds: string[], all: Article[], n: number): string[] {
  const countryOf = new Map(all.map((a) => [a.id, a.countryCode]));
  return recentIds
    .map((id) => countryOf.get(id))
    .filter((c): c is string => !!c)
    .slice(0, n);
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
}

function weightedPick<T>(items: T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= weight(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}
