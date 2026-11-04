import type { OutletInput } from "../outlets";

// Sub-Saharan Africa: Nigeria, Kenya, South Africa, Ghana, Ethiopia
// One entry per outlet; see outlets.ts for the fields. New ids: "<country code>-<name>".
export const AFRICA: OutletInput[] = [
  // ---------- Nigeria ----------
  {
    id: "ng-punch",
    name: "The Punch",
    countryCode: "ng",
    lang: "en",
    baseCity: "Lagos",
    baseLat: 6.5244,
    baseLng: 3.3792,
    feeds: ["https://punchng.com/feed"],
  },
  {
    id: "ng-premiumtimes",
    name: "Premium Times",
    countryCode: "ng",
    lang: "en",
    baseCity: "Abuja",
    baseLat: 9.0765,
    baseLng: 7.3986,
    // The "Regional" category: news from the 36 states rather than national politics.
    feeds: ["https://www.premiumtimesng.com/category/regional/feed"],
  },
  {
    id: "ng-aminiya",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "Aminiya",
    countryCode: "ng",
    lang: "ha",
    baseCity: "Abuja",
    baseLat: 9.0765,
    baseLng: 7.3986,
    feeds: ["https://aminiya.ng/feed"],
  },
  {
    // Hausa slot after Aminiya was disabled (robots.txt). Legit.ng (privately owned) is
    // headquartered in Lagos; the base is Abuja because the Hausa edition mostly covers the
    // north and federal politics. World news (/duniya/) is skipped. 30 → kept 24, photos 24 (2026-11-04).
    id: "ng-legit-hausa",
    name: "Legit.ng Hausa",
    countryCode: "ng",
    lang: "ha",
    baseCity: "Abuja",
    baseLat: 9.0765,
    baseLng: 7.3986,
    feeds: ["https://hausa.legit.ng/rss/all.rss"],
    rules: { dropUrl: /\/duniya\// },
  },
  // ---------- Kenya ----------
  {
    id: "ke-citizen",
    name: "Citizen Digital",
    countryCode: "ke",
    lang: "en",
    baseCity: "Nairobi",
    baseLat: -1.2921,
    baseLng: 36.8219,
    feeds: ["https://www.citizen.digital/sitemap-news.xml"],
  },
  {
    // Privately owned (Nation Media). Its og:image is empty; usable once the pipeline
    // fell back to the WordPress featured image: 10 → kept 10, photos 10 (2026-11-04).
    id: "ke-taifaleo",
    name: "Taifa Leo",
    countryCode: "ke",
    lang: "sw",
    baseCity: "Nairobi",
    baseLat: -1.2921,
    baseLng: 36.8219,
    feeds: ["https://taifaleo.nation.co.ke/feed"],
  },
  {
    // Reserve: state broadcaster; replaced by Taifa Leo for the Swahili slot.
    id: "ke-kbc-swahili",
    name: "KBC Swahili",
    countryCode: "ke",
    lang: "sw",
    baseCity: "Nairobi",
    baseLat: -1.2921,
    baseLng: 36.8219,
    feeds: ["https://swahili.kbc.co.ke/feed/"],
    enabled: false,
  },
  // ---------- South Africa ----------
  {
    id: "za-maroela",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "Maroela Media",
    countryCode: "za",
    lang: "af",
    baseCity: "Pretoria",
    baseLat: -25.7479,
    baseLng: 28.2293,
    feeds: ["https://maroelamedia.co.za/feed/"],
    rules: {
      // Daily devotional and poetry columns ("Gedagte vir die dag | ...", "Gedig | ...").
      dropTitle: /^(Gedagte vir die dag|Gedig)\s*(\||&#124;)/,
    },
  },
  {
    id: "za-isolezwe",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "Isolezwe",
    countryCode: "za",
    lang: "zu",
    baseCity: "Durban",
    baseLat: -29.8587,
    baseLng: 31.0218,
    feeds: ["https://www.isolezwe.co.za/rss"],
  },
  {
    id: "za-groundup",
    name: "GroundUp",
    countryCode: "za",
    lang: "en",
    baseCity: "Cape Town",
    baseLat: -33.9249,
    baseLng: 18.4241,
    feeds: ["https://www.groundup.org.za/sitenews/rss/"],
  },
  {
    // Vaal Triangle (southern Gauteng) local paper, Caxton. Articles are about half Afrikaans,
    // half English; restores some Afrikaans after Maroela Media was disabled (robots.txt).
    // Articles are served from citizen.co.za/vaalweekblad/ (robots.txt ok there too).
    id: "za-vaalweekblad",
    name: "Vaalweekblad",
    countryCode: "za",
    lang: "af",
    baseCity: "Vanderbijlpark",
    baseLat: -26.7114,
    baseLng: 27.8381,
    feeds: ["https://www.vaalweekblad.com/feed/"],
  },
  {
    // Pietermaritzburg daily (Caxton); covers KwaZulu-Natal after Isolezwe was disabled.
    // The "News" category feed; opinion pages skipped.
    id: "za-witness",
    name: "The Witness",
    countryCode: "za",
    lang: "en",
    baseCity: "Pietermaritzburg",
    baseLat: -29.6006,
    baseLng: 30.3794,
    feeds: ["https://witness.co.za/news/feed/"],
    rules: { dropUrl: /\/opinion\// },
  },
  // ---------- Ghana ----------
  {
    id: "gh-myjoyonline",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "MyJoyOnline",
    countryCode: "gh",
    lang: "en",
    baseCity: "Accra",
    baseLat: 5.6037,
    baseLng: -0.187,
    // The "Regional" section: stories from the 16 regions outside the national news cycle.
    feeds: ["https://www.myjoyonline.com/news/regional/feed/"],
  },
  {
    id: "gh-graphic",
    name: "Graphic Online (Daily Graphic)",
    countryCode: "gh",
    lang: "en",
    baseCity: "Accra",
    baseLat: 5.6037,
    baseLng: -0.187,
    feeds: ["https://www.graphic.com.gh/news/general-news.feed?type=rss"],
  },
  {
    // The Ghanaian Chronicle, privately owned daily (Graphic is state-owned). "General News"
    // category: domestic stories from the regions (Tema, Mpohor...). Its regional category
    // feeds exist but are months stale. 10 → kept 10, photos 10 (2026-11-04).
    id: "gh-chronicle",
    name: "The Ghanaian Chronicle",
    countryCode: "gh",
    lang: "en",
    baseCity: "Accra",
    baseLat: 5.6037,
    baseLng: -0.187,
    feeds: ["https://thechronicle.com.gh/category/general-news/feed/"],
  },
  // ---------- Ethiopia ----------
  {
    // State-affiliated (Fana Media Corporation). Independent outlets block bots or have no feed; see media/africa.md.
    id: "et-fana",
    name: "ፋና (Fana)",
    countryCode: "et",
    lang: "am",
    baseCity: "Addis Ababa",
    baseLat: 9.03,
    baseLng: 38.74,
    feeds: ["https://www.fanamc.com/feed/"],
  },
];
