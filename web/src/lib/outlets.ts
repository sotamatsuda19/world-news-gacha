import { z } from "zod";
import { COUNTRIES, insideCountry, isCountryCode } from "./countries";

// The outlet list. Everything outlet-specific lives here as data, so adding an
// outlet never requires touching the collector's code.
//
// Selection policy: 2-4 free outlets per country, spread across regions.
// Check a candidate first with `npm run check-outlet -- <id>` (works for enabled: false too).

const OutletSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits and hyphens only"),
    name: z.string().min(1),
    countryCode: z.string().refine(isCountryCode, "not in countries.ts"),
    lang: z.string().regex(/^[a-z]{2,3}$/, "a language code such as ja, en, hi"),
    baseCity: z.string().min(1),
    baseLat: z.number().min(-90).max(90),
    baseLng: z.number().min(-180).max(180),
    // RSS / RDF / Atom feeds, or Google-News style sitemaps (news-sitemap.xml). Detected automatically.
    feeds: z.array(z.url()).min(1),
    enabled: z.boolean().default(true),
    // Outlet-specific clean-up applied to each feed item.
    rules: z
      .object({
        dropTitle: z.instanceof(RegExp).optional(), // skip items whose title matches (e.g. members-only marker)
        stripTitle: z.instanceof(RegExp).optional(), // remove this part of the title (e.g. " - Site name")
        dropUrl: z.instanceof(RegExp).optional(), // skip items whose URL matches (e.g. live blogs)
      })
      .default({}),
  })
  // Catches swapped latitude/longitude and wrong country codes.
  .refine((o) => !isCountryCode(o.countryCode) || insideCountry(o.countryCode, o.baseLat, o.baseLng), {
    message: "base coordinates are outside the country (lat/lng swapped?)",
  })
  .transform((o) => ({ ...o, country: COUNTRIES[o.countryCode as keyof typeof COUNTRIES].name }));

export type Outlet = z.output<typeof OutletSchema>;

const LIST: z.input<typeof OutletSchema>[] = [
  // ---------- Japan ----------
  {
    id: "nhk",
    name: "NHK",
    countryCode: "jp",
    lang: "ja",
    baseCity: "Tokyo",
    baseLat: 35.6762,
    baseLng: 139.6503,
    feeds: [
      "https://news.web.nhk/n-data/conf/na/rss/cat0.xml",
      "https://news.web.nhk/n-data/conf/na/rss/cat1.xml",
      "https://news.web.nhk/n-data/conf/na/rss/cat3.xml",
    ],
  },
  {
    id: "okinawatimes",
    name: "沖縄タイムス",
    countryCode: "jp",
    lang: "ja",
    baseCity: "Naha",
    baseLat: 26.2124,
    baseLng: 127.6809,
    feeds: ["https://www.okinawatimes.co.jp/list/feed/rss"],
    rules: {
      // "... - 沖縄タイムス＋プラス　プレミアム" marks members-only articles.
      dropTitle: /プレミアム\s*$/,
      stripTitle: /\s*-\s*沖縄タイムス＋プラス.*$/,
    },
  },
  {
    id: "tbsnewsdig",
    name: "TBS NEWS DIG",
    countryCode: "jp",
    lang: "ja",
    baseCity: "Tokyo",
    baseLat: 35.6762,
    baseLng: 139.6503,
    feeds: ["https://newsdig.tbs.co.jp/list/feed/rss"],
  },
  // ---------- United States ----------
  {
    id: "texastribune",
    name: "The Texas Tribune",
    countryCode: "us",
    lang: "en",
    baseCity: "Austin",
    baseLat: 30.2672,
    baseLng: -97.7431,
    feeds: ["https://feeds.texastribune.org/feeds/main/"],
  },
  {
    id: "kqed",
    name: "KQED",
    countryCode: "us",
    lang: "en",
    baseCity: "San Francisco",
    baseLat: 37.7749,
    baseLng: -122.4194,
    feeds: ["https://ww2.kqed.org/news/feed/"],
  },
  // ---------- India ----------
  {
    id: "amarujala",
    name: "अमर उजाला (Amar Ujala)",
    countryCode: "in",
    lang: "hi",
    baseCity: "Noida",
    baseLat: 28.5355,
    baseLng: 77.391,
    feeds: ["https://www.amarujala.com/rss/breaking-news.xml"],
    rules: { dropUrl: /\/live\// }, // live blogs make poor letters
  },
  {
    // Replaced The Hindu (2026-11-04): every Hindu article page declares isAccessibleForFree=false.
    id: "hindustantimes",
    name: "Hindustan Times",
    countryCode: "in",
    lang: "en",
    baseCity: "New Delhi",
    baseLat: 28.6139,
    baseLng: 77.209,
    feeds: ["https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml"],
  },
];

// Validated once at startup: a typo stops the collector and the dev server with
// a message naming the outlet and the field, instead of failing quietly later.
function validate(list: typeof LIST): Outlet[] {
  const ids = new Set<string>();
  return list.map((raw, i) => {
    const parsed = OutletSchema.safeParse(raw);
    if (!parsed.success) {
      const where = raw.id ?? `#${i}`;
      throw new Error(`outlets.ts: outlet "${where}" is invalid:\n${z.prettifyError(parsed.error)}`);
    }
    if (ids.has(parsed.data.id)) throw new Error(`outlets.ts: duplicate id "${parsed.data.id}"`);
    ids.add(parsed.data.id);
    return parsed.data;
  });
}

/** Every outlet in the list, including disabled candidates. */
export const ALL_OUTLETS = validate(LIST);
/** Outlets the daily collection uses. */
export const OUTLETS = ALL_OUTLETS.filter((o) => o.enabled);

export const outletById = (id: string) => ALL_OUTLETS.find((o) => o.id === id);
