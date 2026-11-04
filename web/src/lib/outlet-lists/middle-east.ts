import type { OutletInput } from "../outlets";

// Middle East: Turkey, Israel, Iran, UAE, Saudi Arabia, Egypt
// One entry per outlet; see outlets.ts for the fields. New ids: "<country code>-<name>".
export const MIDDLE_EAST: OutletInput[] = [
  // ---------- Turkey ----------
  {
    id: "tr-hurriyet",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "Hürriyet",
    countryCode: "tr",
    lang: "tr",
    baseCity: "Istanbul",
    baseLat: 41.0082,
    baseLng: 28.9784,
    feeds: ["https://www.hurriyet.com.tr/rss/gundem"],
  },
  {
    id: "tr-yeniasir",
    name: "Yeni Asır",
    countryCode: "tr",
    lang: "tr",
    baseCity: "Izmir",
    baseLat: 38.4237,
    baseLng: 27.1428,
    feeds: ["https://www.yeniasir.com.tr/rss/izmir.xml"],
  },
  {
    id: "tr-hurriyetdailynews",
    name: "Hürriyet Daily News",
    countryCode: "tr",
    lang: "en",
    baseCity: "Istanbul",
    baseLat: 41.0082,
    baseLng: 28.9784,
    feeds: ["https://www.hurriyetdailynews.com/rss/turkey"],
  },
  {
    // Bursa regional daily; replaces Hürriyet (2026-11-04). Feed mixes Bursa and national news.
    id: "tr-bursahakimiyet",
    name: "Bursa Hakimiyet",
    countryCode: "tr",
    lang: "tr",
    baseCity: "Bursa",
    baseLat: 40.1885,
    baseLng: 29.061,
    feeds: ["https://www.bursahakimiyet.com.tr/rss"],
  },
  // ---------- Israel ----------
  {
    id: "il-walla",
    name: "וואלה! חדשות (Walla! News)",
    countryCode: "il",
    lang: "he",
    baseCity: "Tel Aviv",
    baseLat: 32.0853,
    baseLng: 34.7818,
    feeds: ["https://rss.walla.co.il/feed/1"],
  },
  {
    id: "il-jpost",
    name: "The Jerusalem Post",
    countryCode: "il",
    lang: "en",
    baseCity: "Jerusalem",
    baseLat: 31.7683,
    baseLng: 35.2137,
    feeds: ["https://www.jpost.com/rss/rssfeedsisraelnews.aspx"],
  },
  // ---------- Iran ----------
  {
    id: "ir-mehr",
    name: "خبرگزاری مهر (Mehr News Agency)",
    countryCode: "ir",
    lang: "fa",
    baseCity: "Tehran",
    baseLat: 35.6892,
    baseLng: 51.389,
    feeds: ["https://www.mehrnews.com/rss/tp/19"], // "Provinces" section: news from all over Iran
  },
  {
    id: "ir-hamshahri",
    name: "همشهری آنلاین (Hamshahri Online)",
    countryCode: "ir",
    lang: "fa",
    baseCity: "Tehran",
    baseLat: 35.6892,
    baseLng: 51.389,
    feeds: ["https://www.hamshahrionline.ir/rss/tp/7"], // "City" section: Tehran city news
  },
  // ---------- United Arab Emirates ----------
  {
    id: "ae-emaratalyoum",
    name: "الإمارات اليوم (Emarat Al Youm)",
    countryCode: "ae",
    lang: "ar",
    baseCity: "Dubai",
    baseLat: 25.2048,
    baseLng: 55.2708,
    // Google-News sitemap of the "Local" section
    feeds: ["https://www.emaratalyoum.com/news-sitemaps-1.368006/local-section-1.1075475?ot=ot.AjaxPageLayout"],
  },
  {
    id: "ae-thenational",
    name: "The National",
    countryCode: "ae",
    lang: "en",
    baseCity: "Abu Dhabi",
    baseLat: 24.4539,
    baseLng: 54.3773,
    feeds: ["https://www.thenationalnews.com/arc/outboundfeeds/rss/category/news/uae/?outputType=xml"],
  },
  // ---------- Saudi Arabia ----------
  {
    id: "sa-alwatan",
    name: "الوطن (Al Watan)",
    countryCode: "sa",
    lang: "ar",
    baseCity: "Abha",
    baseLat: 18.2164,
    baseLng: 42.5053,
    feeds: ["https://www.alwatan.com.sa/rssFeed/1"], // "Local" section
  },
  {
    id: "sa-saudigazette",
    name: "Saudi Gazette",
    countryCode: "sa",
    lang: "en",
    baseCity: "Jeddah",
    baseLat: 21.4858,
    baseLng: 39.1925,
    feeds: ["https://saudigazette.com.sa/rssFeed/74"], // "Saudi Arabia" section
  },
  // ---------- Egypt ----------
  {
    id: "eg-youm7",
    name: "اليوم السابع (Youm7)",
    countryCode: "eg",
    lang: "ar",
    baseCity: "Cairo",
    baseLat: 30.0444,
    baseLng: 31.2357,
    feeds: ["https://www.youm7.com/rss/SectionRss?SectionID=296"], // "Governorates" section
  },
  {
    id: "eg-masrawy",
    name: "مصراوي (Masrawy)",
    countryCode: "eg",
    lang: "ar",
    baseCity: "Cairo",
    baseLat: 30.0444,
    baseLng: 31.2357,
    // "Governorates" and "Egypt" sections (each feed holds only the latest 10 items)
    feeds: [
      "https://www.masrawy.com/rss/feed/204/%D9%85%D8%AD%D8%A7%D9%81%D8%B8%D8%A7%D8%AA",
      "https://www.masrawy.com/rss/feed/35/%D9%85%D8%B5%D8%B1",
    ],
  },
  {
    id: "eg-dailynewsegypt",
    name: "Daily News Egypt",
    countryCode: "eg",
    lang: "en",
    baseCity: "Cairo",
    baseLat: 30.0444,
    baseLng: 31.2357,
    feeds: ["https://www.dailynewsegypt.com/category/egypt/feed/"],
  },
];
