import type { Article, Place } from "../types";

// What the about page (/about) needs from today's articles, worked out on the server
// once an hour (see app/about/page.tsx). Pure: the same articles give the same result.
//
// - One light per country: the place of that country's most interesting article
//   (highest AI score; ties go to the first). The light is only where the camera
//   flies and where a headline flashes up; the real draw comes from /api/draw.
// - The counts shown in the text ("40 countries, 108 papers") are counted here, so
//   the page never claims more than what is in the draw today.

export type AboutLight = {
  countryCode: string;
  place: Pick<Place, "city" | "names" | "lat" | "lng">;
  // A real headline from this country, shown as the light flashes up (original language).
  title: string;
  lang: string;
  outletName: string;
};

export type AboutData = {
  lights: AboutLight[];
  countries: number;
  outlets: number;
  articles: number;
};

export function aboutData(articles: Article[]): AboutData {
  const best = new Map<string, Article>();
  for (const a of articles) {
    const current = best.get(a.countryCode);
    if (!current || a.score > current.score) best.set(a.countryCode, a);
  }
  const lights = [...best.values()]
    .sort((a, b) => a.countryCode.localeCompare(b.countryCode))
    .map((a) => ({
      countryCode: a.countryCode,
      place: { city: a.place.city, names: a.place.names, lat: a.place.lat, lng: a.place.lng },
      title: a.title,
      lang: a.lang,
      outletName: a.outletName,
    }));
  return {
    lights,
    countries: lights.length,
    outlets: new Set(articles.map((a) => a.outletId)).size,
    articles: articles.length,
  };
}
