// Small pieces that the rest of the system relies on: the outlet list, country
// boxes, language handling and the outlet rules.
import { describe, expect, it } from "vitest";
import { applyRules, type RawItem } from "../../scripts/lib/pipeline";
import { insideCountry } from "./countries";
import { baseLang } from "./i18n";
import { ALL_OUTLETS, outletById } from "./outlets";

describe("outlet list", () => {
  it("loads and passes validation", () => {
    // outlets.ts throws while loading if any entry is invalid, so getting here is the test.
    expect(ALL_OUTLETS.length).toBeGreaterThan(0);
  });

  it("has every outlet's base inside its own country", () => {
    for (const o of ALL_OUTLETS) {
      expect(insideCountry(o.countryCode as "jp", o.baseLat, o.baseLng), o.id).toBe(true);
    }
  });
});

describe("insideCountry", () => {
  it("accepts real places, including remote islands", () => {
    expect(insideCountry("jp", 26.21, 127.68)).toBe(true); // Naha
    expect(insideCountry("jp", 24.29, 153.98)).toBe(true); // Minami-Torishima
    expect(insideCountry("us", 21.31, -157.86)).toBe(true); // Honolulu
    expect(insideCountry("in", 28.61, 77.21)).toBe(true); // New Delhi
  });

  it("rejects swapped latitude/longitude and places abroad", () => {
    expect(insideCountry("jp", 139.65, 35.68)).toBe(false); // Tokyo with lat/lng swapped
    expect(insideCountry("us", 51.51, -0.13)).toBe(false); // London
    expect(insideCountry("in", 24.86, 67.0)).toBe(false); // Karachi, just west of India
  });
});

describe("baseLang", () => {
  it("keeps supported languages and drops the region", () => {
    expect(baseLang("ja-JP")).toBe("ja");
    expect(baseLang("en-US")).toBe("en");
  });

  it("falls back to English for anything else (no paying for arbitrary languages)", () => {
    expect(baseLang("fr-FR")).toBe("en");
    expect(baseLang("xx-anything")).toBe("en");
    expect(baseLang("")).toBe("en");
  });
});

describe("outlet rules", () => {
  const item = (title: string, url = "https://example.com/a"): RawItem => ({
    title,
    url,
    description: "",
    publishedAt: null,
    feedImage: null,
  });

  it("drops Okinawa Times members-only articles and cleans the title", () => {
    const okinawa = outletById("okinawatimes")!;
    expect(applyRules(okinawa, item("記事 - 沖縄タイムス＋プラス　プレミアム"))).toBeNull();
    expect(applyRules(okinawa, item("記事 - 沖縄タイムス＋プラス　ニュース"))?.title).toBe("記事");
  });

  it("drops Amar Ujala live blogs", () => {
    const amar = outletById("amarujala")!;
    expect(applyRules(amar, item("t", "https://www.amarujala.com/live/world/x"))).toBeNull();
    expect(applyRules(amar, item("t", "https://www.amarujala.com/india/x"))).not.toBeNull();
  });

  it("leaves other outlets' items untouched", () => {
    expect(applyRules(outletById("nhk")!, item("見出し"))?.title).toBe("見出し");
  });

  it("drops items without a title or URL", () => {
    expect(applyRules(outletById("nhk")!, item(""))).toBeNull();
    expect(applyRules(outletById("nhk")!, item("t", ""))).toBeNull();
  });
});
