import type { OutletInput } from "../outlets";

// Western Europe: UK, France, Germany, Italy, Spain
// One entry per outlet; see outlets.ts for the fields. New ids: "<country code>-<name>".
export const WESTERN_EUROPE: OutletInput[] = [
  // ---------- United Kingdom ----------
  {
    // Public broadcaster. Nation/region feeds only (the UK "top stories" feed is full of world news).
    id: "gb-bbc",
    enabled: false, // articles live on www.bbc.co.uk, whose robots.txt turns away Anthropic's crawlers (2026-11-04)
    name: "BBC News",
    countryCode: "gb",
    lang: "en",
    baseCity: "London",
    baseLat: 51.5074,
    baseLng: -0.1278,
    feeds: [
      "https://feeds.bbci.co.uk/news/scotland/rss.xml",
      "https://feeds.bbci.co.uk/news/northern_ireland/rss.xml",
      "https://feeds.bbci.co.uk/news/england/rss.xml",
    ],
    rules: { dropUrl: /\/live\// }, // live pages make poor letters
  },
  {
    id: "gb-men",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "Manchester Evening News",
    countryCode: "gb",
    lang: "en",
    baseCity: "Manchester",
    baseLat: 53.4808,
    baseLng: -2.2426,
    feeds: ["https://www.manchestereveningnews.co.uk/news/?service=rss"],
    rules: { dropTitle: /^LIVE\b/ }, // live blogs
  },
  {
    // Welsh-language service of the BBC (public broadcaster).
    id: "gb-bbccymrufyw",
    enabled: false, // articles live on www.bbc.co.uk, whose robots.txt turns away Anthropic's crawlers (2026-11-04)
    name: "BBC Cymru Fyw",
    countryCode: "gb",
    lang: "cy",
    baseCity: "Cardiff",
    baseLat: 51.4816,
    baseLng: -3.1791,
    feeds: ["https://feeds.bbci.co.uk/cymrufyw/rss.xml"],
    rules: { dropUrl: /\/live\// },
  },
  {
    // London section only (the other feeds carry national and world news).
    id: "gb-standard",
    name: "Evening Standard",
    countryCode: "gb",
    lang: "en",
    baseCity: "London",
    baseLat: 51.5074,
    baseLng: -0.1278,
    feeds: ["https://www.standard.co.uk/news/london/rss"],
  },
  {
    // Scotland's main commercial broadcaster, free. Own photo on about a quarter of
    // articles (the rest get a place photo): 50 → fresh 30 → AI -4 → kept 26, photos 7,
    // places 17. robots.txt ok for feed and article sites (2026-11-04).
    id: "gb-stv",
    name: "STV News",
    countryCode: "gb",
    lang: "en",
    baseCity: "Glasgow",
    baseLat: 55.8642,
    baseLng: -4.2518,
    feeds: ["https://news.stv.tv/feed"],
  },
  {
    // Independent local site, south coast. Feed holds the latest 10:
    // 10 → kept 10, photos 10, places 10. robots.txt ok (2026-11-04).
    id: "gb-brightonhovenews",
    name: "Brighton & Hove News",
    countryCode: "gb",
    lang: "en",
    baseCity: "Brighton",
    baseLat: 50.8225,
    baseLng: -0.1372,
    feeds: ["https://www.brightonandhovenews.org/feed/"],
  },
  // ---------- France ----------
  {
    // Public broadcaster (France Télévisions), regional newsrooms.
    id: "fr-france3",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "France 3 Régions",
    countryCode: "fr",
    lang: "fr",
    baseCity: "Paris",
    baseLat: 48.8566,
    baseLng: 2.3522,
    feeds: [
      "https://france3-regions.franceinfo.fr/grand-est/rss",
      "https://france3-regions.franceinfo.fr/nouvelle-aquitaine/rss",
      "https://france3-regions.franceinfo.fr/provence-alpes-cote-d-azur/rss",
      "https://france3-regions.franceinfo.fr/bretagne/rss",
    ],
    rules: { dropTitle: /^(REPLAY|DIRECT|VIDÉO|VIDEO)\b/ }, // video replays and live pages
  },
  {
    id: "fr-actu",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "actu.fr",
    countryCode: "fr",
    lang: "fr",
    baseCity: "Rennes",
    baseLat: 48.1173,
    baseLng: -1.6778,
    feeds: ["https://actu.fr/rss.xml"],
  },
  {
    id: "fr-corsenetinfos",
    name: "Corse Net Infos",
    countryCode: "fr",
    lang: "fr",
    baseCity: "Ajaccio",
    baseLat: 41.9192,
    baseLng: 8.7386,
    feeds: ["https://www.corsenetinfos.corsica/xml/syndication.rss"],
  },
  {
    id: "fr-lyonmag",
    name: "LyonMag",
    countryCode: "fr",
    lang: "fr",
    baseCity: "Lyon",
    baseLat: 45.764,
    baseLng: 4.8357,
    feeds: ["https://www.lyonmag.com/rss"],
  },
  {
    // Occitanie section only (the main feed also carries Paris-area stories).
    id: "fr-lejournaltoulousain",
    name: "Le Journal Toulousain",
    countryCode: "fr",
    lang: "fr",
    baseCity: "Toulouse",
    baseLat: 43.6047,
    baseLng: 1.4442,
    feeds: ["https://www.lejournaltoulousain.fr/occitanie/feed/"],
  },
  // ---------- Germany ----------
  {
    // Public broadcaster (ARD); regional pages produced by NDR.
    id: "de-tagesschau-nord",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "tagesschau Regional (NDR)",
    countryCode: "de",
    lang: "de",
    baseCity: "Hamburg",
    baseLat: 53.5511,
    baseLng: 9.9937,
    feeds: [
      "https://www.tagesschau.de/inland/regional/niedersachsen/index~rss2.xml",
      "https://www.tagesschau.de/inland/regional/hamburg/index~rss2.xml",
      "https://www.tagesschau.de/inland/regional/schleswigholstein/index~rss2.xml",
      "https://www.tagesschau.de/inland/regional/mecklenburgvorpommern/index~rss2.xml",
    ],
  },
  {
    // Public broadcaster for Saxony, Saxony-Anhalt and Thuringia.
    id: "de-mdr",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "MDR Nachrichten",
    countryCode: "de",
    lang: "de",
    baseCity: "Leipzig",
    baseLat: 51.3397,
    baseLng: 12.3731,
    feeds: ["https://www.mdr.de/nachrichten/index-rss.xml"],
  },
  {
    id: "de-merkur",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "Merkur.de (Bayern)",
    countryCode: "de",
    lang: "de",
    baseCity: "Munich",
    baseLat: 48.1351,
    baseLng: 11.582,
    feeds: ["https://www.merkur.de/bayern/rssfeed.rdf"],
  },
  {
    // Cologne daily (DuMont). Google-News sitemap; KStA+ articles are dropped as paywalled.
    // 300 → fresh 30 → paywalled 0 → AI -6 → kept 24, photos 24, places 16 (2026-11-04).
    id: "de-ksta",
    name: "Kölner Stadt-Anzeiger",
    countryCode: "de",
    lang: "de",
    baseCity: "Cologne",
    baseLat: 50.9375,
    baseLng: 6.9603,
    feeds: ["https://www.ksta.de/xml/newssitemap.xml"],
  },
  {
    // Munich daily. Google-News sitemap; some AZ+ articles (≈6/30) are dropped as paywalled.
    // 111 → fresh 30 → paywalled 6 → AI -7 → kept 17, photos 17, places 11 (2026-11-04).
    id: "de-abendzeitung",
    name: "Abendzeitung München",
    countryCode: "de",
    lang: "de",
    baseCity: "Munich",
    baseLat: 48.1351,
    baseLng: 11.582,
    feeds: ["https://www.abendzeitung-muenchen.de/news-artikel.sitemap.xml"],
  },
  {
    // Leipziger Internet Zeitung: online paper for Leipzig and Saxony.
    // 50 → fresh 21 → paywalled 0 → AI -3 → kept 18, photos 18, places 17 (2026-11-04).
    id: "de-liz",
    name: "Leipziger Internet Zeitung",
    countryCode: "de",
    lang: "de",
    baseCity: "Leipzig",
    baseLat: 51.3397,
    baseLng: 12.3731,
    feeds: ["https://www.l-iz.de/feed"],
  },
  // ---------- Italy ----------
  {
    // News agency; regional desks in the south and the islands.
    id: "it-ansa",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "ANSA",
    countryCode: "it",
    lang: "it",
    baseCity: "Rome",
    baseLat: 41.9028,
    baseLng: 12.4964,
    feeds: [
      "https://www.ansa.it/sicilia/notizie/sicilia_rss.xml",
      "https://www.ansa.it/sardegna/notizie/sardegna_rss.xml",
      "https://www.ansa.it/campania/notizie/campania_rss.xml",
      "https://www.ansa.it/puglia/notizie/puglia_rss.xml",
    ],
  },
  {
    id: "it-ilgiorno",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "Il Giorno",
    countryCode: "it",
    lang: "it",
    baseCity: "Milan",
    baseLat: 45.4642,
    baseLng: 9.19,
    feeds: ["https://www.ilgiorno.it/rss"],
  },
  {
    // Public broadcaster. Usable once hex character references (&#x27;) were decoded:
    // 41 → fresh 30 → AI -9 → kept 21, photos 21, places 11 (2026-11-04).
    id: "it-rainews",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "RaiNews",
    countryCode: "it",
    lang: "it",
    baseCity: "Rome",
    baseLat: 41.9028,
    baseLng: 12.4964,
    feeds: ["https://www.rainews.it/rss/cronaca"],
  },
  {
    // Was a reserve (same QN group as Il Giorno); its robots.txt also turns away
    // Anthropic's crawlers (ClaudeBot, Claude-Web, anthropic-ai), so it can't come back.
    id: "it-lanazione",
    name: "La Nazione",
    countryCode: "it",
    lang: "it",
    baseCity: "Florence",
    baseLat: 43.7696,
    baseLng: 11.2558,
    feeds: ["https://www.lanazione.it/rss"],
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
  },
  {
    // Online paper for the province of Varese (Lombardy). Titles look like
    // "<place> - <headline> - <section> - Varese News"; both ends are stripped.
    // 100 → fresh 30 → paywalled 0 → AI -10 → kept 20, photos 18, places 14 (2026-11-04).
    id: "it-varesenews",
    name: "VareseNews",
    countryCode: "it",
    lang: "it",
    baseCity: "Varese",
    baseLat: 45.8206,
    baseLng: 8.8251,
    feeds: ["https://www.varesenews.it/feed/"],
    rules: { stripTitle: /^[^-]{1,40} - |\s+-\s+[^-]*-\s+Varese News$/g },
  },
  {
    // Online paper for the Marche (Ancona, Pesaro, Macerata, Ascoli).
    // 100 → fresh 30 → paywalled 0 → AI -8 → kept 22, photos 22, places 21 (2026-11-04).
    id: "it-centropagina",
    name: "Centropagina",
    countryCode: "it",
    lang: "it",
    baseCity: "Ancona",
    baseLat: 43.6158,
    baseLng: 13.5189,
    feeds: ["https://www.centropagina.it/feed/"],
  },
  {
    // Calabrian news site of the LaC network (Vibo Valentia). Google-News sitemap.
    // 152 → fresh 30 → paywalled 0 → AI -7 → kept 23, photos 23, places 16 (2026-11-04).
    id: "it-lacnews24",
    name: "LaC News24",
    countryCode: "it",
    lang: "it",
    baseCity: "Vibo Valentia",
    baseLat: 38.6759,
    baseLng: 16.1006,
    feeds: ["https://www.lacnews24.it/sitemaps/lacnews24/sitemap_news1.xml"],
    rules: { dropUrl: /\/italia-mondo\// },
  },
  // ---------- Spain ----------
  {
    id: "es-20minutos",
    enabled: false, // robots.txt turns away Anthropic's crawlers or all bots (2026-11-04)
    name: "20minutos",
    countryCode: "es",
    lang: "es",
    baseCity: "Madrid",
    baseLat: 40.4168,
    baseLng: -3.7038,
    feeds: ["https://www.20minutos.es/rss/nacional/"],
  },
  {
    // City editions only: the front-page feed is mostly sport and national politics.
    id: "es-lavozdegalicia",
    name: "La Voz de Galicia",
    countryCode: "es",
    lang: "es",
    baseCity: "A Coruña",
    baseLat: 43.3623,
    baseLng: -8.4115,
    feeds: [
      "https://www.lavozdegalicia.es/coruna/index.xml",
      "https://www.lavozdegalicia.es/vigo/index.xml",
      "https://www.lavozdegalicia.es/santiago/index.xml",
      "https://www.lavozdegalicia.es/ourense/index.xml",
      "https://www.lavozdegalicia.es/lugo/index.xml",
    ],
  },
  {
    id: "es-elnacional",
    name: "El Nacional.cat",
    countryCode: "es",
    lang: "ca",
    baseCity: "Barcelona",
    baseLat: 41.3874,
    baseLng: 2.1686,
    feeds: ["https://www.elnacional.cat/ca/feed"],
    rules: { dropTitle: /\bDIRECTE\b/ }, // live blogs
  },
  {
    // Online newspaper for Cádiz province (Andalusia).
    id: "es-cadizdirecto",
    name: "Cádiz Directo",
    countryCode: "es",
    lang: "es",
    baseCity: "Cádiz",
    baseLat: 36.5271,
    baseLng: -6.2886,
    feeds: ["https://www.cadizdirecto.com/feed/"],
  },
];
