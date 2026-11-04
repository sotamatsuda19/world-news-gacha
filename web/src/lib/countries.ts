// Countries the service covers. The bounding box (rough lat/lng rectangle) is used
// to sanity-check coordinates guessed by the AI and the outlets' base coordinates.
// It includes the main outlying islands; territories that cross the 180° line
// (Alaska's western Aleutians, Russia's Chukotka tip, New Zealand's Chathams) and
// far overseas territories (French overseas departments, Chile's Easter Island) are
// left out, so a story there falls back to the outlet's base city.
// To cover a new country: add it here first, then its outlets in outlet-lists/.

export type Country = {
  name: string; // English
  // [south, west, north, east] in degrees
  bbox: [number, number, number, number];
};

export const COUNTRIES = {
  // East Asia
  jp: { name: "Japan", bbox: [20.4, 122.9, 45.6, 154.0] },
  kr: { name: "South Korea", bbox: [33.0, 124.5, 38.7, 131.9] },
  cn: { name: "China", bbox: [18.1, 73.4, 53.6, 134.8] },
  tw: { name: "Taiwan", bbox: [21.8, 118.1, 26.4, 122.1] },
  // Southeast Asia
  ph: { name: "Philippines", bbox: [4.5, 116.9, 21.2, 126.7] },
  id: { name: "Indonesia", bbox: [-11.1, 94.9, 6.1, 141.1] },
  vn: { name: "Vietnam", bbox: [8.4, 102.1, 23.4, 109.5] },
  th: { name: "Thailand", bbox: [5.6, 97.3, 20.5, 105.7] },
  my: { name: "Malaysia", bbox: [0.8, 99.6, 7.4, 119.3] },
  // Oceania
  au: { name: "Australia", bbox: [-43.7, 112.9, -9.1, 159.2] },
  nz: { name: "New Zealand", bbox: [-47.4, 166.3, -34.3, 178.6] },
  // South Asia
  in: { name: "India", bbox: [6.7, 68.1, 37.1, 97.4] },
  pk: { name: "Pakistan", bbox: [23.6, 60.8, 37.1, 77.9] },
  bd: { name: "Bangladesh", bbox: [20.6, 88.0, 26.7, 92.7] },
  // Middle East
  tr: { name: "Turkey", bbox: [35.8, 25.6, 42.2, 44.9] },
  il: { name: "Israel", bbox: [29.4, 34.2, 33.4, 35.9] },
  ir: { name: "Iran", bbox: [25.0, 44.0, 39.8, 63.4] },
  ae: { name: "United Arab Emirates", bbox: [22.6, 51.5, 26.1, 56.4] },
  sa: { name: "Saudi Arabia", bbox: [16.3, 34.5, 32.2, 55.7] },
  eg: { name: "Egypt", bbox: [22.0, 24.6, 31.7, 36.9] },
  // Africa
  ng: { name: "Nigeria", bbox: [4.2, 2.6, 13.9, 14.7] },
  ke: { name: "Kenya", bbox: [-4.7, 33.9, 5.1, 41.9] },
  za: { name: "South Africa", bbox: [-34.9, 16.4, -22.1, 33.0] },
  gh: { name: "Ghana", bbox: [4.7, -3.3, 11.2, 1.2] },
  et: { name: "Ethiopia", bbox: [3.4, 32.9, 15.0, 48.0] },
  // Western Europe
  gb: { name: "United Kingdom", bbox: [49.8, -8.7, 60.9, 1.8] },
  fr: { name: "France", bbox: [41.3, -5.2, 51.1, 9.6] },
  de: { name: "Germany", bbox: [47.2, 5.8, 55.1, 15.1] },
  it: { name: "Italy", bbox: [35.4, 6.6, 47.1, 18.6] },
  es: { name: "Spain", bbox: [27.6, -18.2, 43.8, 4.4] },
  // Eastern Europe
  pl: { name: "Poland", bbox: [49.0, 14.1, 54.9, 24.2] },
  ua: { name: "Ukraine", bbox: [44.3, 22.1, 52.4, 40.3] },
  ru: { name: "Russia", bbox: [41.2, 19.6, 81.9, 180.0] },
  // North America
  us: { name: "United States", bbox: [18.9, -179.2, 71.4, -66.9] },
  ca: { name: "Canada", bbox: [41.6, -141.1, 83.2, -52.6] },
  mx: { name: "Mexico", bbox: [14.5, -118.4, 32.8, -86.7] },
  // South America
  br: { name: "Brazil", bbox: [-33.8, -74.0, 5.3, -28.8] },
  ar: { name: "Argentina", bbox: [-55.1, -73.6, -21.7, -53.6] },
  co: { name: "Colombia", bbox: [-4.3, -81.8, 13.4, -66.8] },
  cl: { name: "Chile", bbox: [-56.0, -75.8, -17.5, -66.4] },
} satisfies Record<string, Country>;

export type CountryCode = keyof typeof COUNTRIES;

export function isCountryCode(code: string): code is CountryCode {
  return code in COUNTRIES;
}

export function insideCountry(code: CountryCode, lat: number, lng: number): boolean {
  const [south, west, north, east] = COUNTRIES[code].bbox;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}
