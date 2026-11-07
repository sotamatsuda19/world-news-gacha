// Numbers of the draw that the browser decides, in a plain module so that server
// pages (the about and terms pages quote them) can import them too.
// (lib/settings.ts re-exports both for the app.)

// How often a draw comes from near one of the pinned places.
export const PINNED_PLACE_CHANCE = 0.2;

// How many recently drawn article ids the browser sends with a draw, so the same
// letter doesn't come twice in a row. Kept in memory only, for this visit.
export const RECENT_LIMIT = 12;
