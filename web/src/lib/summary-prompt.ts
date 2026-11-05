import type Anthropic from "@anthropic-ai/sdk";
import type { Article } from "./types";

// Everything that decides what the AI writes in a letter's summary, in one place:
// the model, the instructions and the message built from an article.
// Used by the summary API (src/app/api/summary/route.ts) and by the check script
// (scripts/eval-summary.ts), so the script tests exactly what readers get.
// Server only (the API key never reaches the browser), but nothing here calls the API.

export const SUMMARY_MODEL = "claude-haiku-5-5";

// The note may be short. When the feed gives little, the model used to fill the
// third line by explaining what was missing ("The description gives no further
// details…"). It is told that the reader never sees the sources, so it must not
// mention them or what they lack, and that one or two lines are fine.
// Checked with `npm run eval-summary` (2026-11-05, 30 short-description articles ×
// en, ja): such lines went from 15 of 60 summaries to about 5. The rest come mostly
// from teaser headlines ("Will the debts be forgiven?") whose answer isn't in the feed.
export const SUMMARY_SYSTEM = `You write the short note inside a "news letter" that arrives from somewhere in the world.
The reader sees the original headline (possibly in a language they cannot read) and then your note.
Write one to three short lines in the reader's language, one sentence per line, separated by single line breaks.
Keep each line short: about 15 words, or about 35 characters in Japanese, Chinese or Korean.
- what happened, in plain words;
- the key detail, if there is one (a number, a name, a place);
- only if the text itself says so: what happens next or why it matters there.

Tell the news as a friend would, as plain facts. The reader never sees your sources, so never refer to them: no "the headline", "the description", "the article", "the report", "the piece", "the excerpt", "according to the outlet" (or the same words in any language, such as 見出し or 記事).
Never write about what is missing, unclear, unknown or not stated. If a detail is not given, leave it out without comment. A note of one or two lines is fine.
The description may stop mid-sentence; leave out the unfinished part.
Never speculate, never comment on the reporting itself ("it was reported as..."), and never add filler such as "this is drawing attention".
Keep abbreviations you are not sure about as they are instead of guessing what they stand for.
Plain text only: no markdown, no bullets, no blank lines, no quotation of the full headline.`;

// "zh" alone would let the model pick; the reader's menu says Simplified Chinese.
export function readerLanguage(lang: string): string {
  if (lang === "zh") return "Simplified Chinese";
  return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? lang;
}

export function summaryUserMessage(article: Article, lang: string): string {
  // A description that only repeats the headline adds nothing; say there is none.
  const description = article.description && article.description !== article.title ? article.description : "(none)";
  return [
    `Reader's language: ${readerLanguage(lang)}`,
    `Place: ${article.place.city}${article.place.region ? `, ${article.place.region}` : ""}, ${article.country}`,
    `Outlet: ${article.outletName}`,
    `Headline: ${article.title}`,
    `Description: ${description}`,
  ].join("\n");
}

// The full request, so the API route (streaming) and the check script (not
// streaming) send exactly the same thing.
export function summaryRequest(article: Article, lang: string): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: SUMMARY_MODEL,
    max_tokens: 600,
    // A three-line note doesn't need reasoning; skipping it keeps the first token fast.
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system: SUMMARY_SYSTEM,
    messages: [{ role: "user", content: summaryUserMessage(article, lang) }],
  };
}

// Line breaks as the card wants them: one between lines, none at the start, no
// blank lines (the model sometimes adds them anyway). Works on a stream piece by
// piece: `afterNewline` says whether the text so far ended with a line break (or
// nothing has been sent yet), so a break split across two pieces is caught too.
export function tidyLineBreaks(piece: string, afterNewline: boolean): string {
  let out = piece.replace(/\r/g, "").replace(/[ \t]*\n\s*\n/g, "\n");
  if (afterNewline) out = out.replace(/^\s*\n/, "").replace(/^\n+/, "");
  return out;
}
