import type { UiLang } from "../i18n";

// Every line of the about page (/about), in the two UI languages.
//
// The lines that explain the draw must stay true to the code:
//   01 the country is drawn evenly; recently shown countries rest  → lib/draw.ts (countriesToAvoid)
//   02 the headline is weighted by the AI's "interesting abroad" score, never by the reader
//   the recipe: recent ids (RECENT_LIMIT) and pinned places (PINNED_PLACE_CHANCE) → lib/settings.ts
// If one of those changes, change the words here too.

export type Counts = { countries: number; outlets: number; articles: number };
type Pair = { use: string; useNote: string; not: string; notNote: string };

export type AboutText = {
  slogan: [string, string];
  lines: { h: string; p?: string; no?: string }[]; // the narration, in order (see AboutStory)
  received: string; // after the place name on the letter: "from"
  original: string;
  again: string;
  today: string; // under the place name on the globe
  recipeTitle: string;
  use: string;
  not: string;
  pairs: Pair[];
  after: [string, string];
  endTitle: string;
  countLabels: [string, string, string];
  go: string;
  back: string; // the small button, bottom left, that is always there
  terms: string;
  publishers: string;
  contact: string;
};

export function aboutText(lang: UiLang, c: Counts, recentLimit: number, pinEvery: number): AboutText {
  return lang === "ja" ? ja(c, recentLimit, pinEvery) : en(c, recentLimit, pinEvery);
}

const ja = (c: Counts, recentLimit: number, pinEvery: number): AboutText => ({
  slogan: ["世界は、", "小さなニュースでできている。"],
  lines: [
    { h: "私たちは、世界のニュースを\n知っているつもりでいる。" },
    { h: "でも、目に入るのはいつも\n同じ場所の、大きな見出し。" },
    { h: "見出しは、スポットライトに似ている。", p: "照らされた場所だけが、世界のように見えてくる。" },
    {
      h: "本当は、どの町にも今日がある。",
      p: `${c.countries}か国、${c.outlets}の地元の新聞から。\nその町の人のために書かれた、小さな見出し。`,
    },
    { no: "01", h: "まず、国をくじで選ぶ。", p: "記事の多い国も、少ない国も、同じ確率。\n最近届いた国は、しばらくお休みします。" },
    {
      no: "02",
      h: "その国の新聞の、今日の見出しから一本。",
      p: "見出しは、その国の中の話題かどうかと、\n遠くの読み手にとっての面白さで選んでいます。あなたの好みではなく。",
    },
    { no: "03", h: "その町から、あなたへ。", p: "知らない言葉の見出しに、あなたの言葉の短い要約をそえて。" },
    {
      h: "読んだ手紙は、あなたのブラウザの中にだけ。",
      p: "届いた町には、灯りが残ります。\nあなたが何を読んだかを、私たちは残しません。",
    },
    { h: "今日も、どこかの町から。", p: "だれかに合わせて選ばれたのではない一通が、届く。" },
  ],
  received: "から",
  original: "元の新聞へ →",
  again: "もう一通",
  today: "今日の見出し",
  recipeTitle: "くじに使うのは、これだけ。",
  use: "使うもの",
  not: "使わないもの",
  pairs: [
    { use: "偶然", useNote: "国のくじ。どの国も同じ確率", not: "あなたの好み", notNote: "好きそうな国や、ジャンル" },
    { use: "その国の、今日の新聞", useNote: "その町の人のための見出し", not: "みんなが読んでいるもの", notNote: "人気の記事、ランキング" },
    {
      use: "さっきまで届いた手紙",
      useNote: `同じ一通が続かないように（直近${recentLimit}通）`,
      not: "あなたの読み方",
      notNote: "読んでいた時間、クリックした数",
    },
    {
      use: "あなたが自分で決めたこと",
      useNote: `地図に立てたピン。${pinEvery}回に1回、その近くから`,
      not: "あなたについての推測",
      notNote: "年齢や、住んでいる場所",
    },
  ],
  after: ["だから次の一通は、", "あなたにも、私たちにも分からない。"],
  endTitle: "次の一通は、どの町から。",
  countLabels: ["の国", "の新聞", "の見出し"],
  go: "一通、受け取る",
  back: "アプリへ戻る",
  terms: "ご利用にあたって",
  publishers: "掲載メディアの方へ",
  contact: "お問い合わせ",
});

const en = (c: Counts, recentLimit: number, pinEvery: number): AboutText => ({
  slogan: ["The world is made", "of small news."],
  lines: [
    { h: "We think we know\nthe world's news." },
    { h: "But what we see is always\nthe big headlines, from the same places." },
    { h: "A headline is like a spotlight.", p: "Only the places it lights up start to look like the world." },
    {
      h: "In truth, every town has a today.",
      p: `From ${c.outlets} local papers in ${c.countries} countries:\nsmall headlines, written for the people who live there.`,
    },
    {
      no: "01",
      h: "First, a country is drawn by lot.",
      p: "Countries with many stories and with few have the same chance.\nCountries that arrived recently take a rest for a while.",
    },
    {
      no: "02",
      h: "Then one of that country's headlines from today.",
      p: "Chosen for being a local story, and for being interesting\nto a reader far away. Not for your taste.",
    },
    { no: "03", h: "From that town, to you.", p: "A headline in a language you may not know, with a short summary in yours." },
    {
      h: "The letters you read stay in your browser.",
      p: "A light stays on in each town that wrote to you.\nWhat you read, we do not keep.",
    },
    { h: "Today, too, from some town.", p: "A letter that was not chosen to suit anyone arrives." },
  ],
  received: "",
  original: "Read the original →",
  again: "Another one",
  today: "Today's headlines",
  recipeTitle: "This is all the draw uses.",
  use: "Uses",
  not: "Does not use",
  pairs: [
    { use: "Chance", useNote: "A lottery of countries, all equal", not: "Your taste", notNote: "Countries or topics you might like" },
    { use: "That country's paper, today", useNote: "Headlines for the people there", not: "What everyone reads", notNote: "Popular stories, rankings" },
    {
      use: "The letters you just got",
      useNote: `So the same one doesn't repeat (last ${recentLimit})`,
      not: "How you read",
      notNote: "Time spent, clicks",
    },
    {
      use: "What you chose yourself",
      useNote: `Pins on the map: one draw in ${pinEvery} comes from near one`,
      not: "Guesses about you",
      notNote: "Your age, where you live",
    },
  ],
  after: ["So the next letter is unknown", "to you, and to us."],
  endTitle: "Which town will write next?",
  countLabels: ["countries", "papers", "headlines"],
  go: "Receive a letter",
  back: "Back to the app",
  terms: "Using NewsGacha",
  publishers: "For publishers",
  contact: "Contact",
});
