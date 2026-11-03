import { promises as fs } from "fs";
import path from "path";
import type { Article } from "./types";

// File-backed storage. Good enough for a local prototype; swap for a database
// (or KV) before deploying, since serverless hosts don't keep written files.
const DATA_DIR = path.join(process.cwd(), "data");
const ARTICLES_FILE = path.join(DATA_DIR, "articles.json");
const SUMMARY_FILE = path.join(DATA_DIR, "summaries.json");

let articlesCache: { mtimeMs: number; articles: Article[] } | null = null;

export async function loadArticles(): Promise<Article[]> {
  const stat = await fs.stat(ARTICLES_FILE).catch(() => null);
  if (!stat) return [];
  if (articlesCache?.mtimeMs === stat.mtimeMs) return articlesCache.articles;
  const parsed = JSON.parse(await fs.readFile(ARTICLES_FILE, "utf8")) as { articles: Article[] };
  articlesCache = { mtimeMs: stat.mtimeMs, articles: parsed.articles };
  return parsed.articles;
}

export async function saveArticles(articles: Article[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    ARTICLES_FILE,
    JSON.stringify({ collectedAt: new Date().toISOString(), articles }, null, 2),
  );
}

// Summaries are cached per "article id + language" so each one is generated once.
// Deleting data/summaries.json clears the cache (the file's mtime is checked on each read).
let summaries: { mtimeMs: number; map: Record<string, string> } | null = null;

async function loadSummaries() {
  const stat = await fs.stat(SUMMARY_FILE).catch(() => null);
  const mtimeMs = stat?.mtimeMs ?? 0;
  if (summaries?.mtimeMs === mtimeMs) return summaries.map;
  const map = stat ? (JSON.parse(await fs.readFile(SUMMARY_FILE, "utf8")) as Record<string, string>) : {};
  summaries = { mtimeMs, map };
  return map;
}

export async function getSummary(id: string, lang: string) {
  return (await loadSummaries())[`${id}:${lang}`];
}

export async function putSummary(id: string, lang: string, text: string) {
  const all = await loadSummaries();
  all[`${id}:${lang}`] = text;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SUMMARY_FILE, JSON.stringify(all, null, 2));
  summaries = { mtimeMs: (await fs.stat(SUMMARY_FILE)).mtimeMs, map: all };
}
