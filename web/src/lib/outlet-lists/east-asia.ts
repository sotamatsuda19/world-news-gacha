import type { OutletInput } from "../outlets";

// East Asia: Japan, South Korea, China, Taiwan
// One entry per outlet; see outlets.ts for the fields. New ids: "<country code>-<name>".
export const EAST_ASIA: OutletInput[] = [
  // ---------- Japan ----------
  {
    id: "nhk",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
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
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
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
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "TBS NEWS DIG",
    countryCode: "jp",
    lang: "ja",
    baseCity: "Tokyo",
    baseLat: 35.6762,
    baseLng: 139.6503,
    feeds: ["https://newsdig.tbs.co.jp/list/feed/rss"],
  },
  {
    id: "jp-aab",
    name: "AAB秋田朝日放送 (Akita Asahi Broadcasting)",
    countryCode: "jp",
    lang: "ja",
    baseCity: "Akita",
    baseLat: 39.72,
    baseLng: 140.1025,
    // WordPress feed of 10 items (~1.5 days); page 2 covers the rest of the 48h window.
    feeds: ["https://www.aab-tv.co.jp/news/feed", "https://www.aab-tv.co.jp/news/feed?paged=2"],
  },
  {
    // ANN affiliate in Okinawa. Free WordPress feed of 100 items (~5 days).
    id: "jp-qab",
    name: "QAB琉球朝日放送 (Ryukyu Asahi Broadcasting)",
    countryCode: "jp",
    lang: "ja",
    baseCity: "Naha",
    baseLat: 26.2124,
    baseLng: 127.6809,
    feeds: ["https://www.qab.co.jp/news/feed"],
  },
  {
    // Independent UHF station of Mie prefecture (Kinki/Tokai). Free; prefectural news only.
    id: "jp-mietv",
    name: "三重テレビ (Mie TV)",
    countryCode: "jp",
    lang: "ja",
    baseCity: "Tsu",
    baseLat: 34.7303,
    baseLng: 136.5086,
    feeds: ["https://www.mietv.com/news/feed"],
  },
  {
    // Fuji TV network site. Most items are written by the ~28 affiliate stations
    // (UHB Hokkaido, Kansai TV, TNC Fukuoka, Kagoshima TV ...), so stories come from
    // every prefecture; it also carries national desk stories and PR TIMES releases,
    // which the AI scoring mostly drops.
    id: "jp-fnn",
    name: "FNNプライムオンライン (FNN Prime Online)",
    countryCode: "jp",
    lang: "ja",
    baseCity: "Tokyo",
    baseLat: 35.6762,
    baseLng: 139.6503,
    feeds: ["https://www.fnn.jp/news-sitemap.xml"],
  },
  // ---------- South Korea ----------
  {
    id: "kr-yonhap",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "연합뉴스 (Yonhap)",
    countryCode: "kr",
    lang: "ko",
    baseCity: "Seoul",
    baseLat: 37.5665,
    baseLng: 126.978,
    // The 지방 (regional) section: news from every province rather than Seoul politics.
    feeds: ["https://www.yna.co.kr/rss/local.xml"],
    rules: {
      // Obituaries, notice boards, personnel moves, and "[○○소식]" multi-item digests.
      dropTitle: /^\[(부고|게시판|인사|[^\]]*소식)\]/,
    },
  },
  {
    id: "kr-kwnews",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "강원일보 (Kangwon Ilbo)",
    countryCode: "kr",
    lang: "ko",
    baseCity: "Chuncheon",
    baseLat: 37.8813,
    baseLng: 127.7298,
    feeds: ["https://www.kwnews.co.kr/sitemap.xml"],
  },
  {
    id: "kr-imaeil",
    name: "매일신문 (Maeil Shinmun)",
    countryCode: "kr",
    lang: "ko",
    baseCity: "Daegu",
    baseLat: 35.8714,
    baseLng: 128.6014,
    feeds: ["https://www.imaeil.com/rss"],
  },
  {
    // Gwangju daily; the "광주와 호남" (Gwangju & Honam) section only.
    id: "kr-jnilbo",
    name: "전남일보 (Jeonnam Ilbo)",
    countryCode: "kr",
    lang: "ko",
    baseCity: "Gwangju",
    baseLat: 35.1595,
    baseLng: 126.8526,
    feeds: ["https://www.jnilbo.com/rss/S1N3.xml"],
  },
  {
    // Jeju island's online newspaper; nearly everything is island news.
    id: "kr-jejusori",
    name: "제주의소리 (Jeju's Sori)",
    countryCode: "kr",
    lang: "ko",
    baseCity: "Jeju City",
    baseLat: 33.4996,
    baseLng: 126.5312,
    feeds: ["https://www.jejusori.net/rss/allArticle.xml"],
  },
  // ---------- China ----------
  {
    id: "cn-cgtn",
    name: "CGTN",
    countryCode: "cn",
    lang: "en",
    baseCity: "Beijing",
    baseLat: 39.9042,
    baseLng: 116.4074,
    feeds: ["https://www.cgtn.com/subscribe/rss/section/china.xml"],
  },
  {
    id: "cn-globaltimes",
    name: "Global Times",
    countryCode: "cn",
    lang: "en",
    baseCity: "Beijing",
    baseLat: 39.9042,
    baseLng: 116.4074,
    feeds: ["https://www.globaltimes.cn/sitemap.xml"],
  },
  {
    // State news agency, simplified Chinese, stories from all over the mainland.
    // Its pages have no og:image; the lead photo is the first image in the article body.
    id: "cn-chinanews",
    name: "中国新闻网 (China News Service)",
    countryCode: "cn",
    lang: "zh",
    baseCity: "Beijing",
    baseLat: 39.9042,
    baseLng: 116.4074,
    feeds: ["https://www.chinanews.com.cn/rss/society.xml"],
    rules: { photoAfter: "content_maincontent_content" },
  },
  {
    // Reserve: only ~2 articles a day (4 kept); replaced by China News Service.
    id: "cn-sixthtone",
    name: "Sixth Tone",
    countryCode: "cn",
    lang: "en",
    baseCity: "Shanghai",
    baseLat: 31.2304,
    baseLng: 121.4737,
    feeds: ["https://www.sixthtone.com/rss"],
    enabled: false,
  },
  {
    id: "cn-rthk",
    name: "香港電台 (RTHK)",
    countryCode: "cn",
    lang: "zh",
    baseCity: "Hong Kong",
    baseLat: 22.3193,
    baseLng: 114.1694,
    feeds: ["https://rthk.hk/rthk/news/rss/c_expressnews_clocal.xml"],
  },
  // ---------- Taiwan ----------
  {
    id: "tw-ltn",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "自由時報 (Liberty Times)",
    countryCode: "tw",
    lang: "zh",
    baseCity: "Taipei",
    baseLat: 25.033,
    baseLng: 121.5654,
    // 地方 (local) section: stories from every county.
    feeds: ["https://news.ltn.com.tw/rss/local.xml"],
  },
  {
    id: "tw-taipeitimes",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "Taipei Times",
    countryCode: "tw",
    lang: "en",
    baseCity: "Taipei",
    baseLat: 25.033,
    baseLng: 121.5654,
    feeds: ["https://www.taipeitimes.com/xml/index.rss"],
    rules: { dropUrl: /\/News\/(editorials|world|lang)\// },
  },
  {
    // Public Television Service (publicly funded, independent foundation).
    id: "tw-pts",
    name: "公視新聞網 (PTS News)",
    countryCode: "tw",
    lang: "zh",
    baseCity: "Taipei",
    baseLat: 25.033,
    baseLng: 121.5654,
    feeds: ["https://news.pts.org.tw/xml/newsfeed.xml"],
  },
  {
    // Private TV news; Google-News sitemap of every section, narrowed to 地方 (/local/).
    id: "tw-tvbs",
    name: "TVBS新聞網 (TVBS News)",
    countryCode: "tw",
    lang: "zh",
    baseCity: "Taipei",
    baseLat: 25.033,
    baseLng: 121.5654,
    feeds: ["https://news.tvbs.com.tw/sitemap/news-sitemap"],
    rules: { dropUrl: /^(?!https:\/\/news\.tvbs\.com\.tw\/local\/)/ },
  },
];
