import type { OutletInput } from "../outlets";

// Southeast Asia: Philippines, Indonesia, Vietnam, Thailand, Malaysia
// One entry per outlet; see outlets.ts for the fields. New ids: "<country code>-<name>".
export const SOUTHEAST_ASIA: OutletInput[] = [
  // ---------- Philippines ----------
  {
    id: "ph-gma",
    name: "GMA News",
    countryCode: "ph",
    lang: "en",
    baseCity: "Quezon City",
    baseLat: 14.676,
    baseLng: 121.0437,
    feeds: [
      "https://data.gmanetwork.com/gno/rss/news/regions/feed.xml",
      "https://data.gmanetwork.com/gno/rss/news/nation/feed.xml",
    ],
  },
  {
    // Google-News sitemap: SunStar's regional editions (Cebu, Davao, Bacolod,
    // Pampanga, Baguio...) plus the Cebuano tabloid Superbalita Cebu.
    id: "ph-sunstar",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "SunStar",
    countryCode: "ph",
    lang: "en",
    baseCity: "Cebu City",
    baseLat: 10.3157,
    baseLng: 123.8854,
    feeds: ["https://www.sunstar.com.ph/news_sitemap.xml"],
    rules: { dropUrl: /sunstar\.com\.ph\/videos\// },
  },
  {
    // Inquirer group's Tagalog tabloid; the "balita" (news) category, not showbiz.
    id: "ph-bandera",
    name: "Bandera",
    countryCode: "ph",
    lang: "tl",
    baseCity: "Makati",
    baseLat: 14.5547,
    baseLng: 121.0244,
    feeds: ["https://bandera.inquirer.net/category/balita/feed"],
  },
  {
    // Cebu daily of the Inquirer group (replaces SunStar for the Visayas). "Headlines" is
    // the Cebu desk; "News" adds Cebu/Visayas briefs plus some national and wire stories.
    id: "ph-cdn",
    name: "Cebu Daily News",
    countryCode: "ph",
    lang: "en",
    baseCity: "Cebu City",
    baseLat: 10.3157,
    baseLng: 123.8854,
    feeds: [
      "https://cebudailynews.inquirer.net/category/headlines/feed",
      "https://cebudailynews.inquirer.net/category/news/feed",
    ],
  },
  // ---------- Indonesia ----------
  {
    id: "id-detik",
    name: "detikNews",
    countryCode: "id",
    lang: "id",
    baseCity: "Jakarta",
    baseLat: -6.2088,
    baseLng: 106.8456,
    feeds: ["https://news.detik.com/rss"],
  },
  {
    // Independent Bali daily (Denpasar).
    id: "id-nusabali",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "NusaBali",
    countryCode: "id",
    lang: "id",
    baseCity: "Denpasar",
    baseLat: -8.6705,
    baseLng: 115.2126,
    feeds: ["https://www.nusabali.com/rss"],
  },
  {
    id: "id-jubi",
    name: "Jubi Papua",
    countryCode: "id",
    lang: "id",
    baseCity: "Jayapura",
    baseLat: -2.5337,
    baseLng: 140.7181,
    feeds: ["https://jubi.id/feed/"],
  },
  {
    // Independent Bali online paper (replaces NusaBali). Mostly Bali regencies (Badung,
    // Buleleng, Denpasar...); its robots.txt asks for Crawl-delay: 10, so only the main feed.
    id: "id-balipuspanews",
    name: "Bali Puspa News",
    countryCode: "id",
    lang: "id",
    baseCity: "Denpasar",
    baseLat: -8.6705,
    baseLng: 115.2126,
    feeds: ["https://www.balipuspanews.com/feed/"],
  },
  {
    // State news agency ANTARA, North Sumatra bureau.
    id: "id-antara-sumut",
    name: "ANTARA Sumut",
    countryCode: "id",
    lang: "id",
    baseCity: "Medan",
    baseLat: 3.5952,
    baseLng: 98.6722,
    feeds: ["https://sumut.antaranews.com/rss/terkini.xml"],
  },
  // ---------- Vietnam ----------
  // All Vietnamese press operates under state/party licensing (see media notes).
  {
    id: "vn-vnexpress",
    name: "VnExpress",
    countryCode: "vn",
    lang: "vi",
    baseCity: "Hanoi",
    baseLat: 21.0285,
    baseLng: 105.8542,
    feeds: ["https://vnexpress.net/rss/thoi-su.rss"],
  },
  {
    // Organ of the Ho Chi Minh City Communist Youth Union.
    id: "vn-tuoitre",
    name: "Tuổi Trẻ (Tuoi Tre)",
    countryCode: "vn",
    lang: "vi",
    baseCity: "Ho Chi Minh City",
    baseLat: 10.7769,
    baseLng: 106.7009,
    feeds: ["https://tuoitre.vn/rss/thoi-su.rss"],
  },
  // ---------- Thailand ----------
  {
    id: "th-khaosod",
    name: "ข่าวสด (Khaosod)",
    countryCode: "th",
    lang: "th",
    baseCity: "Bangkok",
    baseLat: 13.7563,
    baseLng: 100.5018,
    feeds: ["https://www.khaosod.co.th/feed"],
  },
  {
    id: "th-chiangmainews",
    name: "เชียงใหม่นิวส์ (Chiang Mai News)",
    countryCode: "th",
    lang: "th",
    baseCity: "Chiang Mai",
    baseLat: 18.7883,
    baseLng: 98.9853,
    feeds: ["https://www.chiangmainews.co.th/feed/"],
  },
  // ---------- Malaysia ----------
  {
    id: "my-sinarharian",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "Sinar Harian",
    countryCode: "my",
    lang: "ms",
    baseCity: "Shah Alam",
    baseLat: 3.0733,
    baseLng: 101.5185,
    feeds: ["https://www.sinarharian.com.my/rssFeed/211"],
  },
  {
    // Malay-language tabloid (Media Mulia / Utusan group), "Negara" (domestic) category.
    id: "my-kosmo",
    name: "Kosmo!",
    countryCode: "my",
    lang: "ms",
    baseCity: "Kuala Lumpur",
    baseLat: 3.139,
    baseLng: 101.6869,
    feeds: ["https://www.kosmo.com.my/category/negara/feed/"],
    rules: { stripTitle: /^\[VIDEO\]\s*/i },
  },
  {
    // Sarawak (Borneo) online paper.
    id: "my-dayakdaily",
    name: "DayakDaily",
    countryCode: "my",
    lang: "en",
    baseCity: "Kuching",
    baseLat: 1.5533,
    baseLng: 110.3592,
    feeds: ["https://dayakdaily.com/feed/"],
  },
];
