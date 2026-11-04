import type { OutletInput } from "../outlets";

// South Asia & Oceania: India, Pakistan, Bangladesh, Australia, New Zealand
// One entry per outlet; see outlets.ts for the fields. New ids: "<country code>-<name>".
export const SOUTH_ASIA_OCEANIA: OutletInput[] = [
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
  {
    // Largest Tamil daily; Google-News sitemap (no plain RSS).
    id: "in-dailythanthi",
    name: "தினத்தந்தி (Daily Thanthi)",
    countryCode: "in",
    lang: "ta",
    baseCity: "Chennai",
    baseLat: 13.0827,
    baseLng: 80.2707,
    feeds: ["https://www.dailythanthi.com/news_sitemap.xml"],
  },
  {
    // Times Group's Bengali daily; Google-News sitemap.
    id: "in-eisamay",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "এই সময় (Ei Samay)",
    countryCode: "in",
    lang: "bn",
    baseCity: "Kolkata",
    baseLat: 22.5726,
    baseLng: 88.3639,
    feeds: ["https://eisamay.com/news_sitemap.xml"],
  },
  {
    // Odia daily, Bhubaneswar (replaces Ei Samay, 2026-11-04). WordPress feed.
    id: "in-dharitri",
    name: "ଧରିତ୍ରୀ (Dharitri)",
    countryCode: "in",
    lang: "or",
    baseCity: "Bhubaneswar",
    baseLat: 20.2961,
    baseLng: 85.8245,
    feeds: ["https://www.dharitri.com/feed/"],
    rules: { dropTitle: /Dharitri Cartoon|କାର୍ଟୁନ|ରାଶିଫଳ/ }, // cartoons and horoscopes make poor letters
  },
  // ---------- Pakistan ----------
  {
    id: "pk-dawn",
    name: "Dawn",
    countryCode: "pk",
    lang: "en",
    baseCity: "Karachi",
    baseLat: 24.8607,
    baseLng: 67.0011,
    feeds: ["https://www.dawn.com/feeds/pakistan"],
  },
  {
    id: "pk-express",
    name: "ایکسپریس (Express News)",
    countryCode: "pk",
    lang: "ur",
    baseCity: "Karachi",
    baseLat: 24.8607,
    baseLng: 67.0011,
    feeds: ["https://www.express.pk/feed/"],
  },
  {
    // Sindhi daily. WordPress feeds hold only 10 items, so three are combined.
    id: "pk-awamiawaz",
    name: "عوامي آواز (Awami Awaz)",
    countryCode: "pk",
    lang: "sd",
    baseCity: "Karachi",
    baseLat: 24.8607,
    baseLng: 67.0011,
    feeds: [
      "https://www.awamiawaz.pk/feed/",
      "https://awamiawaz.pk/category/sindh-news/feed",
      "https://awamiawaz.pk/category/national/feed",
    ],
  },
  // ---------- Bangladesh ----------
  {
    id: "bd-prothomalo",
    name: "প্রথম আলো (Prothom Alo)",
    countryCode: "bd",
    lang: "bn",
    baseCity: "Dhaka",
    baseLat: 23.8103,
    baseLng: 90.4125,
    feeds: ["https://www.prothomalo.com/feed/"],
    rules: { dropUrl: /\/video\// }, // video pages have little text
  },
  {
    // Chattogram's regional daily. WordPress feeds hold 10 items and the paper is posted
    // in one morning batch, so local category feeds are added.
    id: "bd-azadi",
    name: "দৈনিক আজাদী (Dainik Azadi)",
    countryCode: "bd",
    lang: "bn",
    baseCity: "Chattogram",
    baseLat: 22.3569,
    baseLng: 91.7832,
    feeds: [
      "https://dainikazadi.net/feed/",
      "https://dainikazadi.net/category/chittagong/feed/",
      "https://dainikazadi.net/category/today-newspaper/city/feed/",
      "https://dainikazadi.net/category/today-newspaper/on-village/feed/",
    ],
  },
  // ---------- Australia ----------
  {
    // Public broadcaster (government-funded, editorially independent). "Just In" feed.
    id: "au-abc",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "ABC News",
    countryCode: "au",
    lang: "en",
    baseCity: "Sydney",
    baseLat: -33.8688,
    baseLng: 151.2093,
    feeds: ["https://www.abc.net.au/news/feed/51120/rss.xml"],
  },
  {
    // Seven West Media's free site (The West Australian itself is paywalled).
    id: "au-perthnow",
    name: "PerthNow",
    countryCode: "au",
    lang: "en",
    baseCity: "Perth",
    baseLat: -31.9505,
    baseLng: 115.8605,
    feeds: ["https://www.perthnow.com.au/news/feed"],
  },
  {
    // Independent Tasmanian news site; its feed holds only the latest 10 items.
    id: "au-pulsetasmania",
    name: "Pulse Tasmania",
    countryCode: "au",
    lang: "en",
    baseCity: "Hobart",
    baseLat: -42.8821,
    baseLng: 147.3272,
    feeds: ["https://www.pulsetasmania.com.au/feed/"],
  },
  {
    // Independent Canberra/regional NSW site (formerly The RiotACT); feed holds the latest 10 items.
    id: "au-region",
    name: "Region (RiotACT)",
    countryCode: "au",
    lang: "en",
    baseCity: "Canberra",
    baseLat: -35.2809,
    baseLng: 149.13,
    feeds: ["https://region.com.au/feed"],
  },
  // ---------- New Zealand ----------
  {
    id: "nz-stuff",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "Stuff",
    countryCode: "nz",
    lang: "en",
    baseCity: "Wellington",
    baseLat: -41.2865,
    baseLng: 174.7762,
    feeds: ["https://www.stuff.co.nz/rss/national"],
  },
  {
    // TVNZ's news site (state-owned broadcaster).
    id: "nz-1news",
    name: "1News",
    countryCode: "nz",
    lang: "en",
    baseCity: "Auckland",
    baseLat: -36.8485,
    baseLng: 174.7633,
    feeds: ["https://www.1news.co.nz/arc/outboundfeeds/rss/?outputType=xml"],
    rules: { dropUrl: /-live\/?$|\/live-/ }, // live blogs make poor letters
  },
  {
    // Whakaata Māori's news service (state-funded Māori broadcaster); replaces Stuff (2026-11-04).
    id: "nz-teaonews",
    name: "Te Ao Māori News",
    countryCode: "nz",
    lang: "en",
    baseCity: "Auckland",
    baseLat: -36.8485,
    baseLng: 174.7633,
    feeds: ["https://www.teaonews.co.nz/arc/outboundfeeds/rss/?outputType=xml"],
  },
];
