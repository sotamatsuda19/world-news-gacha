// Two kinds of language:
// - the UI language (the few words on screen): Japanese or English for now;
// - the summary language (the AI note on the card): the 8 languages below.
// Both default to the browser's language and can be changed in the settings panel.

export const UI_LANGS = ["ja", "en"] as const;
export type UiLang = (typeof UI_LANGS)[number];

// Languages we write summaries (and city names) in. Anything else falls back to
// English, so a caller can't make us generate (and pay for) arbitrary "languages".
// Chinese means Simplified Chinese for now.
export const SUMMARY_LANGS = ["ja", "en", "zh", "ko", "es", "fr", "de", "pt"] as const;
export type SummaryLang = (typeof SUMMARY_LANGS)[number];

type UiKey =
  | "open"
  | "read"
  | "close"
  | "error"
  | "photo"
  | "caption"
  | "loading"
  | "draw"
  | "settings"
  | "uiLanguage"
  | "summaryLanguage"
  | "auto"
  | "sound"
  | "places"
  | "placesHint"
  | "addPlace"
  | "pinHint"
  | "done"
  | "history"
  | "clearHistory"
  | "clearHistoryConfirm"
  | "letters"
  | "aiNote"
  | "howChosen"
  | "about";

const strings: Record<UiLang, Record<UiKey, string>> = {
  ja: {
    open: "タップして開封",
    read: "記事を読む",
    close: "閉じる",
    error: "うまく届きませんでした。もう一度どうぞ。",
    photo: "写真",
    caption: "世界のどこかから、ニュースが届きます",
    loading: "地球を準備しています",
    draw: "ニュースを受け取る",
    settings: "設定",
    uiLanguage: "表示の言語",
    summaryLanguage: "要約の言語",
    auto: "自動",
    sound: "音",
    places: "ゆかりのある場所",
    placesHint: "ときどき、この近くから手紙が届きます（3か所まで）",
    addPlace: "場所を追加",
    pinHint: "地球を長押しして、場所にピンを立ててください",
    done: "完了",
    history: "受け取った手紙",
    clearHistory: "記録を消す",
    clearHistoryConfirm: "受け取った手紙の記録をすべて消しますか？",
    letters: "通",
    aiNote: "要約はAIが書いています。誤りを含むことがあります。",
    howChosen: "この一通は、どうやって選ばれた？",
    about: "NewsGacha について",
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
    settings: "Settings",
    uiLanguage: "Display language",
    summaryLanguage: "Summary language",
    auto: "Auto",
    sound: "Sound",
    places: "Places close to you",
    placesHint: "Now and then, a letter comes from near these places (up to 3)",
    addPlace: "Add a place",
    pinHint: "Press and hold on the Earth to drop a pin",
    done: "Done",
    history: "Letters received",
    clearHistory: "Clear history",
    clearHistoryConfirm: "Delete the record of every letter you have received?",
    letters: "letters",
    aiNote: "Summary written by AI. It may contain mistakes.",
    howChosen: "How was this letter chosen?",
    about: "About NewsGacha",
  },
};

export type UiStrings = Record<UiKey, string>;

export function uiStrings(lang: UiLang): UiStrings {
  return strings[lang];
}

// "ja-JP" -> "ja", "fr-FR" -> "en": the UI language for a browser language.
export function uiLang(lang: string): UiLang {
  return lang.toLowerCase().startsWith("ja") ? "ja" : "en";
}

// "ja-JP" -> "ja", "fr-FR" -> "fr", "sv-SE" -> "en". The summary API keys its cache on this.
export function baseLang(lang: string): SummaryLang {
  const base = (lang || "en").split("-")[0].toLowerCase();
  return (SUMMARY_LANGS as readonly string[]).includes(base) ? (base as SummaryLang) : "en";
}

export function countryName(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

// A language's name written in that language ("한국어", "Deutsch"), for the language menus.
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return code;
  }
}
