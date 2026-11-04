// Shared shapes between the collector script, the API routes and the UI.

export type Place = {
  city: string; // English name, e.g. "Naha"
  region?: string; // state / prefecture, English
  names?: Record<string, string>; // city name per UI language, e.g. { ja: "那覇" }
  lat: number;
  lng: number;
  source: "ai" | "outlet"; // "outlet" = AI could not tell, fell back to the outlet's base
};

export type ArticleImage = {
  url: string;
  source: "ogp" | "fallback";
  // Attribution for fallback (free-license) photos, e.g. "Jane Doe / CC BY-SA 4.0"
  credit?: string;
  creditUrl?: string; // the file's page on Wikimedia Commons
  author?: string;
  license?: string;
  licenseUrl?: string;
};

export type Article = {
  id: string;
  outletId: string;
  outletName: string;
  country: string;
  countryCode: string;
  lang: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string | null;
  image: ArticleImage | null; // OGP image of the article
  fallbackImage: ArticleImage | null; // free-license photo of the place
  place: Place;
  score: number; // 1-5, "how interesting is this to someone abroad"
};

// What /api/draw sends to the browser.
export type DrawResult = Pick<
  Article,
  "id" | "outletName" | "country" | "countryCode" | "lang" | "title" | "url" | "image" | "fallbackImage" | "place"
>;
