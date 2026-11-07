import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { CONTACT_URL } from "@/lib/site";

export const metadata: Metadata = { title: "For publishers — NewsGacha" };

// For the newspapers whose headlines appear, in plain words (the details are in the
// code on GitHub), in Japanese and English: the two must say the same things.
// Every claim must stay true to the collector (scripts/lib/pipeline.ts,
// scripts/lib/robots.ts) and the summary prompt (lib/summary-prompt.ts).
export default function PublishersPage() {
  return (
    <InfoPage
      title={{ ja: "掲載メディアの方へ", en: "For publishers" }}
      lead={{
        ja: "NewsGacha は、世界の地元の新聞の見出しを、遠くの読み手へ一通ずつ届けています。読み手が記事を読むときは、必ずあなたのサイトへ移動します。どのように見出しを扱っているかを、ここにまとめました。",
        en: "NewsGacha delivers headlines from local newspapers around the world to readers far away, one letter at a time. Whenever a reader wants the story, they go to your site to read it. Here is how we handle your headlines.",
      }}
      body={{ ja: <Ja />, en: <En /> }}
    />
  );
}

const contact = (label: string) => (
  <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">
    {label}
  </a>
);

function Ja() {
  return (
    <>
      <h2>載せているもの</h2>
      <ul>
        <li>見出し、新聞名、記事へのリンク</li>
        <li>記事の写真。私たちは写真をコピーして保存・配信せず、読み手のブラウザがあなたのサイトから直接表示します。</li>
        <li>AI による、読み手の言語での短い要約（1〜3文）。見出しと、記事に添えられた短い説明文だけから書いており、記事の本文は使いません。</li>
      </ul>

      <h2>載せないもの</h2>
      <ul>
        <li>記事の本文</li>
        <li>有料の記事。有料の新聞は対象にしておらず、無料の新聞でも有料とされている記事は外しています。</li>
      </ul>

      <h2>集め方</h2>
      <ul>
        <li>1日に1回、公開されているフィード（RSS など）を読みます。</li>
        <li>記事のページは1本につき1回、写真と説明文を確かめるために読みます。</li>
        <li>robots.txt を守ります。すべてのクローラー、または要約に使っている AI の会社のクローラーを拒否しているサイトの記事は使いません。</li>
        <li>私たちのアクセスは「NewsGacha」と名乗っています。</li>
      </ul>

      <h2>保存する期間</h2>
      <p>見出しや記事へのリンクは、公開からおよそ3日のあいだ抽選に使い、そのあとは消えます。要約も数日で自動的に消えます。</p>

      <h2>掲載をやめたいとき</h2>
      <p>
        {contact("お問い合わせ")}
        から新聞名をお知らせください。次の更新から、その新聞の記事を外します。見出しや写真、要約の扱いについてのご指摘も、同じ窓口で受け付けています。
      </p>
      <p>このサービスは広告を載せておらず、収益を得ていません。小さな町の今日を、遠くの人に知ってもらうきっかけになれたらと考えています。</p>
      <p className="info-note">最終更新: 2026年11月6日</p>
    </>
  );
}

function En() {
  return (
    <>
      <h2>What we show</h2>
      <ul>
        <li>The headline, the newspaper’s name and a link to the article</li>
        <li>The article’s photo. We don’t copy, store or serve it: the reader’s browser shows it straight from your site.</li>
        <li>
          A short AI summary (one to three sentences) in the reader’s language, written only from the headline and the short description attached to the article. The article itself is never used.
        </li>
      </ul>

      <h2>What we don’t show</h2>
      <ul>
        <li>The text of the article</li>
        <li>Paid articles. We don’t cover paid newspapers, and even in free ones we leave out articles marked as paid.</li>
      </ul>

      <h2>How we collect</h2>
      <ul>
        <li>Once a day, we read your public feed (RSS or similar).</li>
        <li>We read each article’s page once, to check its photo and description.</li>
        <li>
          We follow robots.txt. We don’t use articles from sites that turn away all crawlers, or the crawlers of the AI company that writes our summaries.
        </li>
        <li>Our requests identify themselves as “NewsGacha”.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>Headlines and links are used in the draw for about three days after they are published, then removed. Summaries also disappear by themselves after a few days.</p>

      <h2>If you would rather not appear</h2>
      <p>
        Please tell us your newspaper’s name through the {contact("contact page")}, and we will leave it out from the next update. The same place is open for anything about how we show your headlines, photos or summaries.
      </p>
      <p>This service carries no ads and makes no money. We hope it can be a small way for people far away to learn about a small town’s today.</p>
      <p className="info-note">Last updated: 6 November 2026</p>
    </>
  );
}
