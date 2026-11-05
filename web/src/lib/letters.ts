import { z } from "zod";
import { createLocalStore } from "./local-store";
import type { ArticleImage, DrawResult } from "./types";

// Every letter the reader has opened, kept in this browser.
// A letter carries its own copy of what the card shows (headline, summary, photo URL),
// because the server forgets articles after 48 hours. Only the photo's URL is kept,
// never the photo itself: the same as a bookmark.

export const MAX_LETTERS = 1000; // about 1-2 KB each; localStorage holds about 5 MB

const Image = z.object({
  url: z.string(),
  source: z.enum(["ogp", "fallback"]),
  credit: z.string().optional(),
  creditUrl: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  licenseUrl: z.string().optional(),
}) satisfies z.ZodType<ArticleImage>;

const Letter = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  outletName: z.string(),
  countryCode: z.string(),
  lang: z.string(), // the article's language
  place: z.object({
    city: z.string(),
    names: z.record(z.string(), z.string()).optional(),
    lat: z.number(),
    lng: z.number(),
  }),
  image: Image.nullable(),
  summary: z.string(),
  summaryLang: z.string(),
  receivedAt: z.number(), // ms since 1970
});
export type Letter = z.infer<typeof Letter>;

// Read letter by letter: one broken entry is dropped instead of losing them all.
const Letters = z.array(z.unknown()).transform((items) =>
  items.flatMap((item) => {
    const parsed = Letter.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  }),
);

const EMPTY: Letter[] = [];
export const lettersStore = createLocalStore<Letter[]>("newsgarden:letters:v1", Letters, EMPTY);

// Newest first. Receiving the same article again moves it to the front.
export function saveLetter(article: DrawResult, image: ArticleImage | null, summary: string, summaryLang: string) {
  const letter: Letter = {
    id: article.id,
    title: article.title,
    url: article.url,
    outletName: article.outletName,
    countryCode: article.countryCode,
    lang: article.lang,
    place: { city: article.place.city, names: article.place.names, lat: article.place.lat, lng: article.place.lng },
    image,
    summary,
    summaryLang,
    receivedAt: Date.now(),
  };
  lettersStore.update((all) => [letter, ...all.filter((l) => l.id !== letter.id)].slice(0, MAX_LETTERS));
}

// The summary usually finishes after the card has opened; fill it in then.
export function setLetterSummary(id: string, summary: string, summaryLang: string) {
  if (!summary.trim()) return;
  lettersStore.update((all) => all.map((l) => (l.id === id ? { ...l, summary, summaryLang } : l)));
}

export function clearLetters() {
  lettersStore.set(EMPTY);
}

// Letters close together on the globe share one light. 0.5° is about 50 km:
// a city and its suburbs become one light; neighbouring cities stay apart.
export type LetterLight = { key: string; lat: number; lng: number; letters: Letter[] };

export function groupLetters(letters: Letter[], cellDeg = 0.5): LetterLight[] {
  const lights = new Map<string, LetterLight>();
  for (const letter of letters) {
    const key = `${Math.round(letter.place.lat / cellDeg)}:${Math.round(letter.place.lng / cellDeg)}`;
    const light = lights.get(key);
    if (light) light.letters.push(letter);
    else lights.set(key, { key, lat: letter.place.lat, lng: letter.place.lng, letters: [letter] });
  }
  return [...lights.values()];
}
