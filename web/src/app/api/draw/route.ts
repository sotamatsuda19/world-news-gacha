import type { NextRequest } from "next/server";
import { loadArticles } from "@/lib/store";
import type { Article, DrawResult } from "@/lib/types";

// Draws one article. Countries are picked evenly first, so a country with many
// outlets doesn't crowd out the others; inside a country, more interesting
// stories (higher score) are more likely.
export async function GET(req: NextRequest) {
  const recent = new Set((req.nextUrl.searchParams.get("recent") ?? "").split(",").filter(Boolean));
  const all = await loadArticles();
  if (all.length === 0) {
    return Response.json({ error: "No articles collected yet. Run `npm run collect`." }, { status: 503 });
  }

  const pool = all.filter((a) => !recent.has(a.id));
  const candidates = pool.length > 0 ? pool : all;

  const byCountry = new Map<string, Article[]>();
  for (const a of candidates) byCountry.set(a.countryCode, [...(byCountry.get(a.countryCode) ?? []), a]);
  const countries = [...byCountry.keys()];
  const country = countries[Math.floor(Math.random() * countries.length)];
  const article = weightedPick(byCountry.get(country)!, (a) => a.score * a.score);

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

function weightedPick<T>(items: T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= weight(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}
