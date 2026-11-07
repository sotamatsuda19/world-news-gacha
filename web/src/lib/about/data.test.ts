import { describe, expect, it } from "vitest";
import { aboutData } from "./data";
import type { Article } from "../types";

let nextId = 0;
function article(countryCode: string, outletId: string, score: number, city = "X"): Article {
  const id = `a${nextId++}`;
  return {
    id,
    outletId,
    outletName: outletId,
    country: countryCode,
    countryCode,
    lang: "en",
    title: `title ${id}`,
    description: "",
    url: `https://example.com/${id}`,
    publishedAt: null,
    image: null,
    fallbackImage: null,
    place: { city, lat: 1, lng: 2, source: "ai" },
    score,
  };
}

describe("aboutData", () => {
  it("makes one light per country, at its most interesting article", () => {
    const data = aboutData([
      article("jp", "asahi", 2, "Tokyo"),
      article("jp", "ryukyu", 5, "Naha"),
      article("fr", "ouest", 3, "Rennes"),
      article("jp", "kobe", 5, "Kobe"), // a tie keeps the first one
    ]);
    expect(data.lights.map((l) => [l.countryCode, l.place.city])).toEqual([
      ["fr", "Rennes"],
      ["jp", "Naha"],
    ]);
  });

  it("counts countries, outlets and articles from what is in the draw", () => {
    const data = aboutData([article("jp", "asahi", 3), article("jp", "asahi", 3), article("kr", "hani", 3)]);
    expect(data).toMatchObject({ countries: 2, outlets: 2, articles: 3 });
  });

  it("copes with no articles at all", () => {
    expect(aboutData([])).toEqual({ lights: [], countries: 0, outlets: 0, articles: 0 });
  });
});
