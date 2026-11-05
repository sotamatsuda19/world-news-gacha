// Small pieces that the rest of the system relies on: the outlet list, country
// boxes, language handling and the outlet rules.
import { describe, expect, it } from "vitest";
import { applyRules, byLocalName, cleanUrl, fitsScript, isPaywalled, looksLikePlaceholder, pageImage, stripHtml, type RawItem } from "../../scripts/lib/pipeline";
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
    expect(baseLang("fr-FR")).toBe("fr");
    expect(baseLang("pt-BR")).toBe("pt");
  });

  it("falls back to English for anything else (no paying for arbitrary languages)", () => {
    expect(baseLang("sv-SE")).toBe("en");
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

describe("looksLikePlaceholder", () => {
  it("spots site-wide placeholder images by file name", () => {
    expect(looksLikePlaceholder("https://example.com/static/logo.png")).toBe(true);
    expect(looksLikePlaceholder("https://example.com/img/og-default.jpg")).toBe(true);
    expect(looksLikePlaceholder("https://www.hindustantimes.com/ht-img/img/2025/06/30/1600x900/logo/ht-generic_india1_17512.jpg")).toBe(true);
  });

  it("keeps real photos, even inside a /logo/ folder or named <id>_default", () => {
    // Hindustan Times keeps real photos in a folder called "logo"
    expect(looksLikePlaceholder("https://www.hindustantimes.com/ht-img/img/2026/11/03/1600x900/logo/pexels-photo-11209277.jpeg")).toBe(false);
    // newsvl.ru (Vladivostok) names every article photo "<number>_default"
    expect(looksLikePlaceholder("https://static.vl.ru/news/1730000123_default")).toBe(false);
    expect(looksLikePlaceholder("https://cdn.example.com/2026/11/protest-in-city.jpg")).toBe(false);
    // Bitban CMS (Telemadrid, Canal Sur): "<uuid>_facebook-aspect-ratio_default_0.jpg"
    expect(looksLikePlaceholder("https://img.example.es/media/0b6f3c2e-1a2b-4c3d-8e9f-0123456789ab_facebook-aspect-ratio_default_0.jpg")).toBe(false);
    // CBC serves photos from an IIIF image server: ".../full/max/0/default.jpg" means default quality
    expect(looksLikePlaceholder("https://i.cbc.ca/ais/abc-123,1730000000000/full/max/0/default.jpg")).toBe(false);
  });
});

describe("stripHtml", () => {
  it("removes tags and decodes named, decimal and hex character references", () => {
    expect(stripHtml("<p>Rock &amp; roll</p>")).toBe("Rock & roll");
    expect(stripHtml("It&#8217;s &#8216;fine&#8217;")).toBe("It\u2019s \u2018fine\u2019");
    expect(stripHtml("caf&#xe9; &mdash; ok")).toBe("caf\u00e9 \u2014 ok");
  });

  it("handles feeds that escape twice", () => {
    expect(stripHtml("It&amp;#8217;s &amp;apos;ok&amp;apos;")).toBe("It\u2019s 'ok'");
  });

  it("leaves unknown entities alone and collapses whitespace", () => {
    expect(stripHtml("a &unknown;   b")).toBe("a &unknown; b");
  });
});

describe("byLocalName", () => {
  it("finds a sitemap tag whatever namespace prefix the site used", () => {
    expect(byLocalName({ "news:title": "A" }, "title")).toBe("A");
    expect(byLocalName({ "n:title": "B" }, "title")).toBe("B"); // Diario Concepción, El Mostrador
    expect(byLocalName({ title: "C" }, "title")).toBe("C");
  });

  it("doesn't match a different name that merely ends the same way", () => {
    expect(byLocalName({ "news:subtitle": "x" }, "title")).toBeUndefined();
    expect(byLocalName(undefined, "title")).toBeUndefined();
  });
});

describe("pageImage", () => {
  const page = "https://news.example.com/2026/11/story/";

  it("prefers og:image", () => {
    const html = '<meta property="og:image" content="https://cdn.example.com/a.jpg"><img class="wp-post-image" src="/b.jpg">';
    expect(pageImage(html, page)).toBe("https://cdn.example.com/a.jpg");
  });

  it("falls back to the JSON-LD image when og:image is empty", () => {
    const html = '<meta property="og:image" content=""><script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","image":{"url":"https://cdn.example.com/ld.jpg"}}]}</script>';
    expect(pageImage(html, page)).toBe("https://cdn.example.com/ld.jpg");
  });

  it("falls back to the WordPress featured image (Taifa Leo)", () => {
    const html = '<img width="800" src="/wp-content/uploads/photo.jpg" class="attachment-large size-large wp-post-image" alt="">';
    expect(pageImage(html, page)).toBe("https://news.example.com/wp-content/uploads/photo.jpg");
  });

  it("uses an outlet's photoAfter marker when nothing else is there (China News Service)", () => {
    const html = '<img src="/logo.png"><div class="content_maincontent_content"><p>text</p><img src="//i2.chinanews.com.cn/simg/a.jpg"></div>';
    expect(pageImage(html, "https://www.chinanews.com.cn/sh/x.shtml", "content_maincontent_content")).toBe("https://i2.chinanews.com.cn/simg/a.jpg");
    expect(pageImage(html, "https://www.chinanews.com.cn/sh/x.shtml")).toBeNull(); // no marker: don't guess
  });

  it("returns null when there is no photo at all", () => {
    expect(pageImage("<p>text only</p>", page)).toBeNull();
  });
});

describe("cleanUrl", () => {
  it("drops utm_ tracking parameters and keeps the rest", () => {
    expect(cleanUrl("https://www.kosmo.com.my/2026/11/04/a/?utm_source=rss&utm_medium=feed")).toBe("https://www.kosmo.com.my/2026/11/04/a/");
    expect(cleanUrl("https://example.com/news?id=42&utm_campaign=x")).toBe("https://example.com/news?id=42");
  });
});

describe("isPaywalled", () => {
  it("recognises the paywall markers we know", () => {
    expect(isPaywalled('{"@type":"NewsArticle","isAccessibleForFree":false}')).toBe(true);
    expect(isPaywalled('{"isAccessibleForFree":"False"}')).toBe(true);
    expect(isPaywalled('{"articleAccessMode":"subscription"}')).toBe(true); // Daily Dispatch
  });

  it("lets free articles through", () => {
    expect(isPaywalled('{"isAccessibleForFree":"True"}')).toBe(false);
    expect(isPaywalled('{"articleAccessMode":"free"}')).toBe(false);
    expect(isPaywalled("<p>plain article</p>")).toBe(false);
  });
});

describe("fitsScript", () => {
  it("accepts katakana and kanji place names for Japanese", () => {
    expect(fitsScript("ja", "イスラマバード")).toBe(true);
    expect(fitsScript("ja", "鳥羽市")).toBe(true);
    expect(fitsScript("ja", "ラス・アル・ハイマ")).toBe(true);
  });

  it("rejects local scripts the AI sometimes returns instead", () => {
    expect(fitsScript("ja", "اسلام آباد")).toBe(false); // Urdu
    expect(fitsScript("ja", "순천")).toBe(false); // Korean
    expect(fitsScript("ja", "Toronto")).toBe(false);
    expect(fitsScript("ja", "")).toBe(false);
  });

  it("checks Chinese, Korean and Latin-script languages too", () => {
    expect(fitsScript("zh", "伊斯兰堡")).toBe(true);
    expect(fitsScript("zh", "イスラマバード")).toBe(false);
    expect(fitsScript("ko", "순천")).toBe(true);
    expect(fitsScript("ko", "順天")).toBe(false);
    expect(fitsScript("fr", "Saint-Étienne")).toBe(true);
    expect(fitsScript("de", "München")).toBe(true);
    expect(fitsScript("pt", "São Paulo")).toBe(true);
    expect(fitsScript("es", "L'Hospitalet de Llobregat")).toBe(true);
    expect(fitsScript("es", "Москва")).toBe(false);
  });
});
