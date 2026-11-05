// Cleans an article's description (from the feed, or the page's og:description)
// before the AI sees it, both when collecting (place and score) and when writing
// a reader's summary. What gets removed was found in real collected data:
//
// - "[CDATA[ … ]]>" left over from feeds that wrap text in CDATA sections twice
// - WordPress's "The post <title> appeared first on <site>." footer (and its German,
//   Spanish, French, Portuguese and Italian versions)
// - "read more" links in many languages, and "[…]" cut-off markers
// - text cut off mid-sentence: trimmed back to the last full sentence
// - a description that only repeats the headline: nothing new, so it becomes ""
//
// Pure function (text in, text out), so it is tested in src/lib/description.test.ts.

// "Read more" and friends, at the very end. Case-insensitive.
const READ_MORE = [
  "read more",
  "continue reading",
  "read the full (?:story|article)",
  "devamı için tıklayınız",
  "devamı için tıklayın",
  "haberin devamı",
  "続きを読む",
  "続きはこちら",
  "lire la suite",
  "leer más",
  "seguir leyendo",
  "leia mais",
  "continue lendo",
  "weiterlesen",
  "mehr lesen",
  "selengkapnya",
  "baca selengkapnya",
  "더보기",
  "читати далі",
  "читать далее",
];
const READ_MORE_END = new RegExp(`[\\s…:»>-]*(?:${READ_MORE.join("|")})[\\s.…!»>]*$`, "i");

const WORDPRESS_FOOTER = new RegExp(
  "\\s*(?:<p>\\s*)?(?:The post|Der Beitrag|La entrada|L’article|L'article|O post|Il post) .+ " +
    "(?:appeared first on|erschien zuerst auf|se publicó primero en|est apparu en premier sur|apareceu primeiro em|è apparso per la prima volta su) .+$",
);
// The same footer when the feed text was cut (at 600 characters) before it ended:
// a "[…]" marker followed by the footer's first words.
const WORDPRESS_FOOTER_CUT = /\s*\[…\]\s*(?:<p>\s*)?(?:The post|Der Beitrag|La entrada|L’article|L'article|O post|Il post)\s.*$/;

// Ends of a complete sentence: Latin, East Asian, Indic (danda) and Arabic/Urdu punctuation.
const SENTENCE_END = /[.!?。！？」』”"।॥؟۔]/;

export function cleanDescription(description: string, title: string): string {
  let text = description.replace(/\s+/g, " ").trim();

  // CDATA wrapper (with or without the leading "<!", which tag stripping eats).
  text = text.replace(/^(?:<!)?\[CDATA\[\s*/, "").replace(/\s*\]\]>?$/, "");

  // WordPress's default feed footer, "The post <title> appeared first on <site>.",
  // sometimes after a stray "<p>". (Line breaks are already spaces here.)
  text = text.replace(WORDPRESS_FOOTER, "").replace(WORDPRESS_FOOTER_CUT, " […]"); // marker kept: trimmed below

  text = text.replace(READ_MORE_END, "");

  // Cut off by the feed: "… […]", "…[...]", "…" or "...". Keep only whole sentences,
  // if that still leaves something; otherwise keep the text without the marker.
  const cut = /\s*(?:\[(?:…|\.\.\.|&hellip;)\]|…|\.\.\.)$/;
  if (cut.test(text)) {
    text = text.replace(cut, "");
    const lastEnd = lastIndexOfSentenceEnd(text);
    if (lastEnd >= 0 && lastEnd + 1 >= text.length * 0.3) text = text.slice(0, lastEnd + 1);
  }
  text = text.trim();

  // Only the headline again (or a piece of it): nothing to add.
  const plain = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  const t = plain(title);
  const d = plain(text);
  if (!d || d === t || (d.length >= 10 && t.includes(d))) return "";
  return text;
}

function lastIndexOfSentenceEnd(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) if (SENTENCE_END.test(text[i])) return i;
  return -1;
}
