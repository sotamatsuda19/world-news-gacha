// The UI has almost no text, so a tiny dictionary is enough.
// The summary language follows the browser; the UI strings fall back to English.

type UiKey = "open" | "read" | "close" | "error" | "photo" | "caption" | "loading" | "draw";

const strings: Record<"ja" | "en", Record<UiKey, string>> = {
  ja: {
    open: "タップして開封",
    read: "記事を読む",
    close: "閉じる",
    error: "うまく届きませんでした。もう一度どうぞ。",
    photo: "写真",
    caption: "世界のどこかから、ニュースが届きます",
    loading: "地球を準備しています",
    draw: "ニュースを受け取る",
  },
  en: {
    open: "Tap to open",
    read: "Read the article",
    close: "Close",
    error: "The letter got lost. Try again.",
    photo: "Photo",
    caption: "A letter from somewhere on Earth",
    loading: "Preparing the Earth",
    draw: "Receive a letter",
  },
};

export type UiStrings = Record<UiKey, string>;

export function uiStrings(lang: string): UiStrings {
  return lang.startsWith("ja") ? strings.ja : strings.en;
}

// Languages we write summaries in. Anything else falls back to English, so a caller
// can't make us generate (and pay for) summaries in arbitrary "languages".
export const SUPPORTED_LANGS = ["ja", "en"] as const;

// "ja-JP" -> "ja", "fr-FR" -> "en". The summary API keys its cache on this.
export function baseLang(lang: string): string {
  const base = (lang || "en").split("-")[0].toLowerCase();
  return (SUPPORTED_LANGS as readonly string[]).includes(base) ? base : "en";
}

export function countryName(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
