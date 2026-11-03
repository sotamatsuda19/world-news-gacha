// The UI has almost no text, so a tiny dictionary is enough.
// The summary language follows the browser; the UI strings fall back to English.

type UiKey = "open" | "read" | "close" | "error" | "photo";

const strings: Record<"ja" | "en", Record<UiKey, string>> = {
  ja: {
    open: "タップして開封",
    read: "記事を読む",
    close: "閉じる",
    error: "うまく届きませんでした。もう一度どうぞ。",
    photo: "写真",
  },
  en: {
    open: "Tap to open",
    read: "Read the article",
    close: "Close",
    error: "The letter got lost. Try again.",
    photo: "Photo",
  },
};

export type UiStrings = Record<UiKey, string>;

export function uiStrings(lang: string): UiStrings {
  return lang.startsWith("ja") ? strings.ja : strings.en;
}

// "ja-JP" -> "ja". The summary API keys its cache on this.
export function baseLang(lang: string): string {
  return (lang || "en").split("-")[0].toLowerCase();
}

export function countryName(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
