// Countries the service covers. The bounding box (rough lat/lng rectangle, including
// outlying islands) is used to sanity-check coordinates guessed by the AI.
// To cover a new country: add it here first, then its outlets in outlets.ts.

export type Country = {
  name: string; // English
  // [south, west, north, east] in degrees
  bbox: [number, number, number, number];
};

export const COUNTRIES = {
  jp: { name: "Japan", bbox: [20.4, 122.9, 45.6, 154.0] },
  // Contiguous US + Alaska + Hawaii. Alaska's Aleutians cross 180°; the western tip is left out.
  us: { name: "United States", bbox: [18.9, -179.2, 71.4, -66.9] },
  in: { name: "India", bbox: [6.7, 68.1, 37.1, 97.4] },
} satisfies Record<string, Country>;

export type CountryCode = keyof typeof COUNTRIES;

export function isCountryCode(code: string): code is CountryCode {
  return code in COUNTRIES;
}

export function insideCountry(code: CountryCode, lat: number, lng: number): boolean {
  const [south, west, north, east] = COUNTRIES[code].bbox;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}
