import type { Metadata } from "next";
import InfoPage from "@/components/InfoPage";
import { CONTACT_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Terms — NewsGacha" };

// What a reader should know before using the app, in plain words (the details are in
// the code on GitHub), in Japanese and English: the two must say the same things.
// Every claim must stay true to the code: what stays in the browser (lib/letters.ts,
// lib/settings.ts), what reaches the server (/api/draw, /api/summary), how summaries
// are written (lib/summary-prompt.ts).
export default function TermsPage() {
  return (
    <InfoPage
      title={{ ja: "ご利用にあたって", en: "Using NewsGacha" }}
      lead={{
        ja: "NewsGacha は、世界の町の地元の新聞から、その日の見出しを一通ずつ届ける、個人のプロジェクトです。安心して使っていただくために、知っておいてほしいことをまとめました。",
        en: "NewsGacha is a personal project that delivers headlines from local newspapers in towns around the world, one letter at a time. Here is what we would like you to know before you use it.",
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
      <h2>このサービスについて</h2>
      <p>個人が作り、無料で公開しています。広告はなく、収益も得ていません。内容は予告なく変わったり、止まったりすることがあります。</p>

      <h2>あなたのブラウザの中にだけあるもの</h2>
      <ul>
        <li>受け取った手紙の記録</li>
        <li>設定（表示の言語、要約の言語、音）</li>
        <li>「ゆかりのある場所」として立てたピン</li>
      </ul>
      <p>
        これらはお使いのブラウザの中にだけ保存され、私たちには送られません。ほかの端末とは共有されず、設定の「記録を消す」や、ブラウザのデータの削除で消えます。
      </p>

      <h2>サーバーに届くもの</h2>
      <ul>
        <li>手紙を引くとき: 最近届いた記事の番号（同じ手紙が続かないようにするため）。ゆかりのある場所の近くから引くときは、そのおおよその位置。</li>
        <li>要約を読むとき: 記事の番号と、要約の言語。</li>
      </ul>
      <p>
        私たちはこれらを、あなたと結びつけて保存しません。アカウントも、あなたを見分けるための Cookie も、アクセス解析もありません。ただし、サイトを置いているサービスが、通常の運用のためにアクセスの記録を短い期間持っています。
      </p>

      <h2>要約について</h2>
      <p>
        要約は AI が、見出しと、新聞社が記事に添えている短い説明文だけをもとに書いています。記事の本文は読んでいません。そのため、誤りや言い落としを含むことがあります。正確な内容は、元の記事でお確かめください。
      </p>
      <p>同じ記事を読むほかの人のために、要約は数日間保存され、そのあとは自動で消えます。だれが読んだかは保存しません。</p>

      <h2>見出しの選び方</h2>
      <p>
        国はくじで、どの国も同じ確率で選ばれます。その国の見出しは、「遠くの読み手にとっての面白さ」と、その国の中の話題かどうかで、AI が選んでいます。あなたの好みや、ほかの人がよく読んでいるかどうかは使いません。私たちが特定の立場を推すために見出しを選ぶことはありませんが、AI の判断に偏りがありうることはご承知おきください。
      </p>

      <h2>見出し・写真・記事について</h2>
      <p>
        見出しと記事の権利は、それぞれの新聞社にあります。「記事を読む」を押すと新聞社のサイトへ移動し、そこではそのサイトの規約が適用されます。
      </p>
      <p>
        手紙の写真は、私たちのサーバーを通さず、新聞社のサイトから直接表示しています。写真のない記事では、自由に使えるライセンスの写真を、作者とライセンスを添えて使うことがあります。
      </p>

      <h2>おことわり</h2>
      <p>
        内容の正確さや、サービスが止まらずに動き続けることは保証できません。このサービスを使ったことで生じた損害について、法律で認められる範囲で責任を負いかねます。
      </p>

      <h2>お問い合わせ</h2>
      <p>ご質問や、誤りのご指摘は{contact("お問い合わせ")}からどうぞ。</p>
      <p className="info-note">最終更新: 2026年11月6日</p>
    </>
  );
}

function En() {
  return (
    <>
      <h2>About this service</h2>
      <p>It is made by one person and free to use. There are no ads and no income. It may change or stop without notice.</p>

      <h2>What stays only in your browser</h2>
      <ul>
        <li>The letters you have received</li>
        <li>Your settings (display language, summary language, sound)</li>
        <li>The pins you placed as “places close to you”</li>
      </ul>
      <p>
        These are kept only in your browser and are never sent to us. They are not shared with your other devices, and they are gone when you use “Clear history” in the settings or clear your browser’s data.
      </p>

      <h2>What reaches our server</h2>
      <ul>
        <li>
          When you draw a letter: the numbers of the articles you received recently (so the same letter doesn’t come twice). When a letter is drawn from near one of your places: its rough location.
        </li>
        <li>When you read a summary: the article’s number and the summary language.</li>
      </ul>
      <p>
        We don’t keep any of this in a way that is tied to you. There are no accounts, no cookies to recognise you, and no analytics. The service that hosts the site does keep access records for a short time, as part of its normal operation.
      </p>

      <h2>About the summaries</h2>
      <p>
        Summaries are written by AI, only from the headline and the short description the newspaper attaches to the article. It does not read the article itself, so a summary may contain mistakes or leave things out. Please check the original article for the exact facts.
      </p>
      <p>Each summary is kept for a few days for other readers of the same article, then deleted automatically. We don’t record who read it.</p>

      <h2>How headlines are chosen</h2>
      <p>
        The country is drawn by lot, and every country has the same chance. Within that country, AI picks the headline for being interesting to a reader far away and for being a local story. Your taste, and what other people read, are not used. We never choose headlines to push a point of view, but please bear in mind that AI’s judgement can be biased.
      </p>

      <h2>Headlines, photos and articles</h2>
      <p>
        Headlines and articles belong to their newspapers. “Read the article” takes you to the newspaper’s site, where its own terms apply.
      </p>
      <p>
        The photos in the letters are shown straight from the newspaper’s site, without passing through our server. For an article without a photo, we may show a freely licensed photo, credited to its author with its licence.
      </p>

      <h2>Disclaimer</h2>
      <p>
        We cannot guarantee that the content is accurate or that the service will keep running. To the extent permitted by law, we are not liable for any loss arising from its use.
      </p>

      <h2>Contact</h2>
      <p>For questions or corrections, please use the {contact("contact page")}.</p>
      <p className="info-note">Last updated: 6 November 2026</p>
    </>
  );
}
