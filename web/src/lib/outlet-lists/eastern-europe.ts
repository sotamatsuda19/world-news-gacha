import type { OutletInput } from "../outlets";

// Eastern Europe: Poland, Ukraine, Russia
// One entry per outlet; see outlets.ts for the fields. New ids: "<country code>-<name>".
export const EASTERN_EUROPE: OutletInput[] = [
  // ---------- Poland ----------
  {
    id: "pl-rmf24",
    name: "RMF24",
    countryCode: "pl",
    lang: "pl",
    baseCity: "Kraków",
    baseLat: 50.0647,
    baseLng: 19.945,
    feeds: ["https://www.rmf24.pl/fakty/polska/feed"],
  },
  {
    id: "pl-epoznan",
    name: "epoznan.pl",
    countryCode: "pl",
    lang: "pl",
    baseCity: "Poznań",
    baseLat: 52.4064,
    baseLng: 16.9252,
    feeds: ["https://epoznan.pl/rss"],
  },
  // ---------- Ukraine ----------
  {
    id: "ua-zaxid",
    name: "Zaxid.net (Захід.нет)",
    countryCode: "ua",
    lang: "uk",
    baseCity: "Lviv",
    baseLat: 49.8397,
    baseLng: 24.0297,
    feeds: ["https://zaxid.net/rss/all.xml"],
  },
  {
    id: "ua-057",
    name: "057.ua (Сайт міста Харкова)",
    countryCode: "ua",
    lang: "uk",
    baseCity: "Kharkiv",
    baseLat: 49.9935,
    baseLng: 36.2304,
    feeds: ["https://www.057.ua/rss"],
  },
  // ---------- Russia ----------
  {
    id: "ru-lenta",
    name: "Лента.ру (Lenta.ru)",
    countryCode: "ru",
    lang: "ru",
    baseCity: "Moscow",
    baseLat: 55.7558,
    baseLng: 37.6173,
    feeds: ["https://lenta.ru/rss/news/russia"],
  },
  {
    id: "ru-e1",
    name: "Е1 (E1.ru)",
    countryCode: "ru",
    lang: "ru",
    baseCity: "Yekaterinburg",
    baseLat: 56.8389,
    baseLng: 60.6057,
    feeds: ["https://www.e1.ru/rss-feeds/rss.xml"],
  },
  {
    id: "ru-ngs",
    name: "НГС (NGS.ru)",
    countryCode: "ru",
    lang: "ru",
    baseCity: "Novosibirsk",
    baseLat: 55.0084,
    baseLng: 82.9357,
    feeds: ["https://ngs.ru/rss-feeds/rss.xml"],
  },
  {
    id: "ru-primamedia",
    enabled: false, // answers 403 to the collector's honest name (NewsGarden/1.0), 200 to a browser's (2026-11-05)
    name:"ПримаМедиа (PrimaMedia)",
    countryCode: "ru",
    lang: "ru",
    baseCity: "Vladivostok",
    baseLat: 43.1155,
    baseLng: 131.8855,
    feeds: ["https://primamedia.ru/export/new/news_main43.rss"],
  },
];
