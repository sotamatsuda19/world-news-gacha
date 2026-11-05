import { useSyncExternalStore } from "react";
import { z } from "zod";
import { baseLang, SUMMARY_LANGS, UI_LANGS, uiLang, type SummaryLang, type UiLang } from "./i18n";
import { createLocalStore } from "./local-store";

// What the reader can change in the settings panel, and where it's kept.
// Only this browser knows these settings: the server never sees the pinned places,
// only "a letter from near (lat, lng)" on the draws that use one.

export const MAX_PLACES = 3;

const Place = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type PinnedPlace = z.infer<typeof Place>;

const Settings = z.object({
  uiLang: z.enum(UI_LANGS).nullable().catch(null), // null = follow the browser
  summaryLang: z.enum(SUMMARY_LANGS).nullable().catch(null), // null = follow the browser
  sound: z.boolean().catch(true),
  places: z.array(Place).max(MAX_PLACES).catch([]),
});
export type Settings = z.infer<typeof Settings>;

const DEFAULTS: Settings = { uiLang: null, summaryLang: null, sound: true, places: [] };

export const settingsStore = createLocalStore("newsgarden:settings:v1", Settings, DEFAULTS);

// The browser's language ("en" on the server, so the first render matches).
function useBrowserLanguage() {
  return useSyncExternalStore(
    () => () => {},
    () => navigator.language,
    () => "en",
  );
}

// Settings with "auto" resolved to actual languages.
export function useSettings(): Settings & { ui: UiLang; summary: SummaryLang } {
  const settings = settingsStore.use();
  const browser = useBrowserLanguage();
  return {
    ...settings,
    ui: settings.uiLang ?? uiLang(browser),
    summary: settings.summaryLang ?? baseLang(browser),
  };
}

export function updateSettings(change: Partial<Settings>) {
  settingsStore.update((s) => ({ ...s, ...change }));
}

// How often a draw comes from near one of the pinned places.
export const PINNED_PLACE_CHANCE = 0.2;

// Coordinates leave the browser rounded to 0.1° (about 10 km): the search starts
// at 500 km, and a pinned place may be someone's home.
export function roundForRequest(p: PinnedPlace): PinnedPlace {
  return { lat: Math.round(p.lat * 10) / 10, lng: Math.round(p.lng * 10) / 10 };
}
