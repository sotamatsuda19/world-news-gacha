// Moving between the app's globe (/) and the about page's (/about) as one camera move:
// the page that leaves zooms out to the stars and notes which longitude was facing us;
// the page that arrives starts from the stars at that longitude.
//
// Kept in sessionStorage and honoured for a few seconds only, so a visit typed into
// the address bar, or the back button an hour later, starts as usual. It is read, not
// removed: in development React runs effects twice, and both runs must see it.

export type HandoffTo = "about" | "app";

const KEY = (to: HandoffTo) => `newsgarden:to-${to}`;
const FRESH_MS = 3000;

export function handOff(to: HandoffTo, lng: number) {
  try {
    sessionStorage.setItem(KEY(to), JSON.stringify({ lng, at: Date.now() }));
  } catch {
    // Storage blocked: the next page simply starts as usual.
  }
}

// The longitude handed over to this page, if it was handed just now.
export function takeHandoff(to: HandoffTo): number | null {
  try {
    const raw = sessionStorage.getItem(KEY(to));
    if (!raw) return null;
    const { lng, at } = JSON.parse(raw) as { lng: unknown; at: unknown };
    if (typeof lng !== "number" || typeof at !== "number" || Date.now() - at > FRESH_MS) return null;
    return lng;
  } catch {
    return null;
  }
}
