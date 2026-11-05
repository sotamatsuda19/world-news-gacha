// Checks the letter summaries on a fixed set of articles, without touching the
// summaries readers get (data/summaries.json is not read or written).
//
//   npm run eval-summary                 30 articles × en, ja
//   npm run eval-summary -- --n 10 --langs en,ko
//   npm run eval-summary -- --system old-prompt.txt   try other instructions on the same articles
//
// It picks the articles most likely to go wrong: those whose description is
// missing or short, where the model used to pad the note with remarks about its
// sources ("The description gives no further details…"). The same articles are
// picked every run (sorted by a hash of their id), so runs before and after a
// prompt change can be compared. Each summary is checked for:
//   - talk about the sources or missing information (per-language word lists)
//   - more than three lines, or blank lines
// and everything is written to data/eval/summary-<time>.md for reading by eye.
// The word lists only flag candidates; the report is the real check.
//
// Costs one Haiku call per article and language (30 × 2 ≈ a few yen).

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { loadArticles } from "../src/lib/store";
import { summaryRequest, tidyLineBreaks, SUMMARY_MODEL } from "../src/lib/summary-prompt";
import type { Article } from "../src/lib/types";

// Phrases that mean the note is about its sources rather than the news.
const META: Record<string, RegExp> = {
  en: /\b(headline|description|the (text|article|report|post|piece)|opinion piece|no (further|more|other|additional) (details?|information|facts)|not (specified|mentioned|given|provided|stated|clear)|unclear|cut off|is truncated)\b/i,
  ja: /(見出し|説明文|記事(では|には|は)|本文|詳細は(不明|明らか|書かれ|記載)|記載(が|は)|触れられて|明らかにされて|示されていない|書かれていない|途中で切れ|不明です)/,
  zh: /(标题|描述|文章|报道中|未提及|没有提供|不详|未说明)/,
  ko: /(제목|설명|기사(에서|는|에는)|언급되지|나와 있지|알 수 없)/,
  es: /\b(titular|descripción|el artículo|no se (especifica|menciona|detalla)|no (hay|da) más (detalles|información))\b/i,
  fr: /\b(titre|description|l'article|ne (précise|mentionne|donne) pas|pas (plus )?de détails)\b/i,
  de: /\b(Überschrift|Schlagzeile|Beschreibung|der Artikel|nicht (genannt|angegeben|erwähnt)|keine weiteren)\b/i,
  pt: /\b(título|descrição|o artigo|não (especifica|menciona|informa)|sem mais detalhes)\b/i,
};

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const thin = (a: Article) => a.description.length < 100;
const order = (a: Article) => createHash("sha1").update(a.id).digest("hex");

// Runs `fn` over `items`, at most `limit` at a time.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

type Case = { article: Article; lang: string; summary: string; flags: string[] };

function check(summary: string, lang: string): string[] {
  const flags: string[] = [];
  const lines = summary.split("\n");
  if (lines.length > 3) flags.push(`${lines.length} lines`);
  if (lines.some((l) => !l.trim())) flags.push("blank line");
  for (const line of lines) {
    const hit = line.match(META[lang] ?? META.en) ?? (lang === "en" ? null : line.match(META.en));
    if (hit) flags.push(`about the source: "${hit[0]}"`);
  }
  return flags;
}

async function main() {
  const n = Number(arg("n", "30"));
  const langs = arg("langs", "en,ja").split(",");
  const articles = (await loadArticles()).slice().sort((a, b) => order(a).localeCompare(order(b)));
  // The thin ones first; topped up with ordinary ones if there are not enough.
  const picked = [...articles.filter(thin), ...articles.filter((a) => !thin(a))].slice(0, n);

  // --system: instructions from a file instead of SUMMARY_SYSTEM, to compare before/after a change.
  const systemFile = process.argv.includes("--system") ? arg("system", "") : "";
  const system = systemFile ? await readFile(systemFile, "utf8") : null;

  const client = new Anthropic();
  const jobs = picked.flatMap((article) => langs.map((lang) => ({ article, lang })));
  console.log(`${SUMMARY_MODEL}${system ? ` (instructions from ${systemFile})` : ""}: ${picked.length} articles × ${langs.join(", ")} = ${jobs.length} summaries`);

  const cases: Case[] = await mapLimit(jobs, 4, async ({ article, lang }) => {
    try {
      const request = summaryRequest(article, lang);
      const res = await client.messages.create(system ? { ...request, system } : request);
      const raw = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const summary = tidyLineBreaks(raw, true).trim();
      return { article, lang, summary, flags: check(summary, lang) };
    } catch (e) {
      return { article, lang, summary: "", flags: [`error: ${(e as Error).message}`] };
    }
  });

  const flagged = cases.filter((c) => c.flags.length);
  const report = [
    `# Summary check ${new Date().toISOString()}`,
    "",
    `${SUMMARY_MODEL}${system ? ` with instructions from ${systemFile}` : ""}, ${cases.length} summaries, ${flagged.length} flagged.`,
    "",
    ...cases.map((c) =>
      [
        `## ${c.flags.length ? "⚠ " : ""}${c.lang} · ${c.article.outletName} (${c.article.country})`,
        "",
        `- Headline: ${c.article.title}`,
        `- Description: ${c.article.description || "(none)"}`,
        ...(c.flags.length ? [`- Flags: ${c.flags.join("; ")}`] : []),
        "",
        ...c.summary.split("\n").map((l) => `> ${l}`),
        "",
      ].join("\n"),
    ),
  ].join("\n");
  const dir = path.join(process.cwd(), "data", "eval");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `summary-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.md`);
  await writeFile(file, report);

  for (const lang of langs) {
    const mine = cases.filter((c) => c.lang === lang);
    console.log(`${lang}: ${mine.filter((c) => c.flags.length).length} / ${mine.length} flagged`);
  }
  for (const c of flagged) console.log(`  [${c.lang}] ${c.flags.join("; ")}\n      ${c.summary.replace(/\n/g, " / ")}`);
  console.log(`Report: ${path.relative(process.cwd(), file)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
