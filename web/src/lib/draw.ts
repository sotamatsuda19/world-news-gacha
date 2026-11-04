import type { Article } from "./types";

// The draw rules, as a pure function: same articles + same recent ids + same random
// numbers always give the same article. No files, no network, no HTTP — which is
// what makes it easy to test (pass a fixed `random`).
//
// Three steps, each deciding one thing:
//   1. country  — evenly, but not one of the countries just shown (no runs of the same country)
//   2. outlet   — weighted by √(number of articles): a busy outlet is a bit more likely
//                 than a quiet one, but nowhere near in proportion to its volume
//   3. article  — weighted by AI interest score², skipping recently shown articles
// The AI score only acts inside an outlet, so it can't tilt which outlet or country appears.
//
// "Recently shown" is applied only in step 3, on purpose. Applied up front, it removed
// small outlets and countries whose few articles had all been shown lately, so they
// came up far less often than the rules above say (found by draw.test.ts).

/** A function returning a number in [0, 1), like Math.random. */
export type Random = () => number;

/**
 * @param articles  everything collected today
 * @param recentIds recently drawn article ids, newest first
 */
export function drawArticle(articles: Article[], recentIds: string[], random: Random = Math.random): Article | null {
  if (articles.length === 0) return null;

  // 1. Country
  const byCountry = groupBy(articles, (a) => a.countryCode);
  const countries = [...byCountry.keys()];
  const avoid = new Set(recentCountries(recentIds, articles, countriesToAvoid(countries.length)));
  const eligible = countries.filter((c) => !avoid.has(c));
  const country = pickUniform(eligible.length > 0 ? eligible : countries, random);

  // 2. Outlet
  const byOutlet = groupBy(byCountry.get(country)!, (a) => a.outletId);
  const outletId = weightedPick([...byOutlet.keys()], (id) => Math.sqrt(byOutlet.get(id)!.length), random);

  // 3. Article: not one shown recently, unless the outlet has nothing else.
  const recent = new Set(recentIds);
  const outletArticles = byOutlet.get(outletId)!;
  const unseen = outletArticles.filter((a) => !recent.has(a.id));
  return weightedPick(unseen.length > 0 ? unseen : outletArticles, (a) => a.score * a.score, random);
}

/** How many of the latest countries to avoid: 1 with 3 countries, 4 with 15. */
export function countriesToAvoid(countryCount: number): number {
  return Math.max(1, Math.floor((countryCount - 1) / 3));
}

// The countries of the last `n` draws.
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

function pickUniform<T>(items: T[], random: Random): T {
  return items[Math.floor(random() * items.length)];
}

export function weightedPick<T>(items: T[], weight: (item: T) => number, random: Random): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let r = random() * total;
  for (const item of items) {
    r -= weight(item);
    if (r < 0) return item;
  }
  return items[items.length - 1];
}
