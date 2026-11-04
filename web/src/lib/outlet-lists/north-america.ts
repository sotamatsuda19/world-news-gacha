import type { OutletInput } from "../outlets";

// North America: United States, Canada, Mexico
// One entry per outlet; see outlets.ts for the fields. New ids: "<country code>-<name>".
export const NORTH_AMERICA: OutletInput[] = [
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
  {
    id: "us-whyy",
    name: "WHYY",
    countryCode: "us",
    lang: "en",
    baseCity: "Philadelphia",
    baseLat: 39.9526,
    baseLng: -75.1652,
    feeds: ["https://whyy.org/feed/"],
  },
  {
    id: "us-wpr",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "Wisconsin Public Radio",
    countryCode: "us",
    lang: "en",
    baseCity: "Madison",
    baseLat: 43.0731,
    baseLng: -89.4012,
    feeds: ["https://www.wpr.org/feed"],
  },
  {
    // Replaces us-wpr (robots refill, 2026-11-04): 8 → kept 8, photos 8, places 4. Nonprofit, free.
    id: "us-montanafreepress",
    name: "Montana Free Press",
    countryCode: "us",
    lang: "en",
    baseCity: "Helena",
    baseLat: 46.5891,
    baseLng: -112.0391,
    feeds: ["https://montanafreepress.org/feed/"],
  },
  // ---------- Canada ----------
  {
    // Public broadcaster. Added once IIIF photo URLs (".../default.jpg") stopped being
    // mistaken for placeholders: 20 → kept 19, photos 19, places 11 (2026-11-04).
    id: "ca-cbc",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "CBC News",
    countryCode: "ca",
    lang: "en",
    baseCity: "Toronto",
    baseLat: 43.6532,
    baseLng: -79.3832,
    feeds: ["https://www.cbc.ca/webfeed/rss/rss-canada"],
  },
  {
    // Was a reserve behind CBC News; re-enabled when CBC was disabled for robots.txt
    // (2026-11-04): 10 → kept 9, photos 9, places 4. robots.txt ok.
    id: "ca-globalnews",
    name: "Global News",
    countryCode: "ca",
    lang: "en",
    baseCity: "Toronto",
    baseLat: 43.6532,
    baseLng: -79.3832,
    feeds: ["https://globalnews.ca/canada/feed/"],
  },
  {
    id: "ca-radiocanada",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "Radio-Canada Info",
    countryCode: "ca",
    lang: "fr",
    baseCity: "Quebec City",
    baseLat: 46.8139,
    baseLng: -71.208,
    // Regional Québec feeds (Québec City, Saguenay–Lac-Saint-Jean); the national front page is full of world news.
    feeds: [
      "https://ici.radio-canada.ca/info/rss/quebec/en-continu",
      "https://ici.radio-canada.ca/info/rss/saguenay-lac-saint-jean/en-continu",
    ],
    rules: { dropUrl: /\/info\/videos\// },
  },
  {
    id: "ca-tyee",
    name: "The Tyee",
    countryCode: "ca",
    lang: "en",
    baseCity: "Vancouver",
    baseLat: 49.2827,
    baseLng: -123.1207,
    feeds: ["https://thetyee.ca/rss2.xml"],
  },
  {
    // French-language Montréal daily (free). robots.txt explicitly allows ClaudeBot/Claude-Web/anthropic-ai.
    // Replaces ca-radiocanada (2026-11-04): 7 → kept 6, photos 6, places 6. The feed only carries 7 items.
    id: "ca-metro",
    name: "Métro",
    countryCode: "ca",
    lang: "fr",
    baseCity: "Montreal",
    baseLat: 45.5019,
    baseLng: -73.5674,
    feeds: ["https://journalmetro.com/actualites/feed/"],
  },
  // ---------- Mexico ----------
  {
    id: "mx-eluniversal",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "El Universal",
    countryCode: "mx",
    lang: "es",
    baseCity: "Mexico City",
    baseLat: 19.4326,
    baseLng: -99.1332,
    // "Estados" section: news from the states rather than the capital-centred front page.
    feeds: ["https://www.eluniversal.com.mx/arc/outboundfeeds/rss/category/estados/"],
  },
  {
    id: "mx-informador",
    name: "El Informador",
    countryCode: "mx",
    lang: "es",
    baseCity: "Guadalajara",
    baseLat: 20.6597,
    baseLng: -103.3496,
    feeds: ["https://www.informador.mx/rss/jalisco.xml"],
  },
  {
    id: "mx-elimparcial",
    name: "El Imparcial",
    countryCode: "mx",
    lang: "es",
    baseCity: "Hermosillo",
    baseLat: 29.0729,
    baseLng: -110.9559,
    feeds: ["https://www.elimparcial.com/arc/outboundfeeds/rss/"],
    rules: { dropUrl: /elimparcial\.com\/(mundo|espectaculos|estilos|locurioso|juegos|videos|galerias)\// },
  },
  {
    // Oaxaca daily; brings in the South. Replaces mx-eluniversal (2026-11-04): 10 → kept 8, photos 8, places 7.
    id: "mx-nvinoticias",
    name: "NVI Noticias",
    countryCode: "mx",
    lang: "es",
    baseCity: "Oaxaca de Juárez",
    baseLat: 17.0732,
    baseLng: -96.7266,
    feeds: ["https://www.nvinoticias.com/rss.xml"],
    rules: { dropUrl: /nvinoticias\.com\/mundo\// },
  },
];
