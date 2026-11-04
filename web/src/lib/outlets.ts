import { z } from "zod";
import { COUNTRIES, insideCountry, isCountryCode } from "./countries";
import { EAST_ASIA } from "./outlet-lists/east-asia";
import { SOUTHEAST_ASIA } from "./outlet-lists/southeast-asia";
import { SOUTH_ASIA_OCEANIA } from "./outlet-lists/south-asia-oceania";
import { MIDDLE_EAST } from "./outlet-lists/middle-east";
import { AFRICA } from "./outlet-lists/africa";
import { WESTERN_EUROPE } from "./outlet-lists/western-europe";
import { EASTERN_EUROPE } from "./outlet-lists/eastern-europe";
import { NORTH_AMERICA } from "./outlet-lists/north-america";
import { SOUTH_AMERICA } from "./outlet-lists/south-america";

// The outlet list. Everything outlet-specific lives here as data, so adding an
// outlet never requires touching the collector's code.
//
// Selection policy: 2-4 free outlets per country, spread across regions.
// Check a candidate first with `npm run check-outlet -- <id>` (works for enabled: false too).
// The entries themselves are in outlet-lists/<region>.ts.

const noStickyFlags = z.instanceof(RegExp).refine((r) => !r.global && !r.sticky, {
  message: 'remove the "g" / "y" flag (this pattern is used with .test())',
});

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
        // dropTitle / dropUrl are used with .test(): a "g" or "y" flag would make the RegExp
        // remember where it stopped and give alternating answers for the same text.
        dropTitle: noStickyFlags.optional(), // skip items whose title matches (e.g. members-only marker)
        stripTitle: z.instanceof(RegExp).optional(), // remove this part of the title (e.g. " - Site name")
        dropUrl: noStickyFlags.optional(), // skip items whose URL matches (e.g. live blogs)
        // For sites without og:image: the lead photo is the first <img> after this text in
        // the article page (e.g. the class name of the article body).
        photoAfter: z.string().min(1).optional(),
      })
      .default({}),
  })
  // Catches swapped latitude/longitude and wrong country codes.
  .refine((o) => !isCountryCode(o.countryCode) || insideCountry(o.countryCode, o.baseLat, o.baseLng), {
    message: "base coordinates are outside the country (lat/lng swapped?)",
  })
  .transform((o) => ({ ...o, country: COUNTRIES[o.countryCode as keyof typeof COUNTRIES].name }));

export type Outlet = z.output<typeof OutletSchema>;

export type OutletInput = z.input<typeof OutletSchema>;

// The list itself lives in outlet-lists/, one file per region.
const LIST: OutletInput[] = [
  ...EAST_ASIA,
  ...SOUTHEAST_ASIA,
  ...SOUTH_ASIA_OCEANIA,
  ...MIDDLE_EAST,
  ...AFRICA,
  ...WESTERN_EUROPE,
  ...EASTERN_EUROPE,
  ...NORTH_AMERICA,
  ...SOUTH_AMERICA,
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
