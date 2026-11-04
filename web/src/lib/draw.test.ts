import { describe, expect, it } from "vitest";
import { countriesToAvoid, drawArticle, type Random } from "./draw";
import type { Article } from "./types";

// A random number generator that always produces the same sequence for the same seed
// (mulberry32). With it, "draw 20,000 times and count" gives identical numbers on
// every run, so these statistical tests never fail by bad luck.
function seeded(seed: number): Random {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextId = 0;
function article(countryCode: string, outletId: string, score = 3): Article {
  const id = `a${nextId++}`;
  return {
    id,
    outletId,
    outletName: outletId,
    country: countryCode,
    countryCode,
    lang: "en",
    title: id,
    description: "",
    url: `https://example.com/${id}`,
    publishedAt: null,
    image: null,
    fallbackImage: null,
    place: { city: "X", lat: 0, lng: 0, source: "outlet" },
    score,
  };
}
const many = (n: number, countryCode: string, outletId: string, score = 3) =>
  Array.from({ length: n }, () => article(countryCode, outletId, score));

/** Draws `n` times the way the browser does (keeping the last 12 ids) and counts by `key`. */
function simulate(articles: Article[], n: number, key: (a: Article) => string, seed = 1) {
  const random = seeded(seed);
  const recent: string[] = [];
  const counts: Record<string, number> = {};
  const sequence: Article[] = [];
  for (let i = 0; i < n; i++) {
    const a = drawArticle(articles, recent, random)!;
    recent.unshift(a.id);
    recent.length = Math.min(recent.length, 12);
    counts[key(a)] = (counts[key(a)] ?? 0) + 1;
    sequence.push(a);
  }
  const share = (k: string) => (counts[k] ?? 0) / n;
  return { share, sequence };
}

describe("drawArticle", () => {
  it("returns null when there is nothing to draw", () => {
    expect(drawArticle([], [])).toBeNull();
  });

  it("gives the same result for the same random numbers", () => {
    const articles = [...many(5, "jp", "nhk"), ...many(5, "us", "kqed"), ...many(5, "in", "ht")];
    const first = drawArticle(articles, [], seeded(42));
    const second = drawArticle(articles, [], seeded(42));
    expect(first?.id).toBe(second?.id);
  });

  describe("step 1: country", () => {
    const articles = [
      ...many(30, "jp", "nhk"),
      ...many(3, "us", "kqed"), // few articles must not mean a less likely country
      ...many(10, "in", "ht"),
    ];

    it("picks countries evenly, whatever their number of articles", () => {
      const { share } = simulate(articles, 20000, (a) => a.countryCode);
      for (const c of ["jp", "us", "in"]) expect(share(c)).toBeCloseTo(1 / 3, 1);
    });

    it("never shows the same country twice in a row", () => {
      const { sequence } = simulate(articles, 5000, (a) => a.countryCode);
      for (let i = 1; i < sequence.length; i++) {
        expect(sequence[i].countryCode).not.toBe(sequence[i - 1].countryCode);
      }
    });

    it("avoids more recent countries as the list grows", () => {
      expect(countriesToAvoid(1)).toBe(1);
      expect(countriesToAvoid(3)).toBe(1);
      expect(countriesToAvoid(15)).toBe(4);
    });

    it("still draws when there is only one country", () => {
      const only = many(3, "jp", "nhk");
      expect(drawArticle(only, [only[0].id])).not.toBeNull();
    });
  });

  describe("step 2: outlet", () => {
    it("weights outlets by √(number of articles), not by the number itself", () => {
      // 16 vs 4 articles: √16 : √4 = 4 : 2, so the big outlet gets 2/3 (not 16/20 = 80%).
      const articles = [...many(16, "jp", "big"), ...many(4, "jp", "small")];
      const { share } = simulate(articles, 20000, (a) => a.outletId);
      expect(share("big")).toBeCloseTo(2 / 3, 1);
    });

    it("ignores the AI score when choosing the outlet", () => {
      // Same number of articles; one outlet scored generously, the other harshly.
      const articles = [...many(8, "jp", "generous", 5), ...many(8, "jp", "harsh", 2)];
      const { share } = simulate(articles, 20000, (a) => a.outletId);
      expect(share("generous")).toBeCloseTo(0.5, 1);
    });
  });

  describe("step 3: article", () => {
    it("weights articles by score²", () => {
      // score 4 vs 2 → 16 : 4, so the better article appears 80% of the time.
      const good = article("jp", "nhk", 4);
      const plain = article("jp", "nhk", 2);
      const random = seeded(7);
      let goodCount = 0;
      for (let i = 0; i < 20000; i++) if (drawArticle([good, plain], [], random)!.id === good.id) goodCount++;
      expect(goodCount / 20000).toBeCloseTo(0.8, 1);
    });
  });

  describe("recently shown articles", () => {
    it("skips them", () => {
      const [a, b] = many(2, "jp", "nhk");
      for (let i = 0; i < 50; i++) expect(drawArticle([a, b], [a.id], seeded(i))!.id).toBe(b.id);
    });

    it("draws anyway when every article was shown recently", () => {
      const [a, b] = many(2, "jp", "nhk");
      expect(drawArticle([a, b], [a.id, b.id])).not.toBeNull();
    });
  });
});
