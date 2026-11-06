import { promises as fs } from "fs";
import path from "path";
import type { Article } from "../types";

// Local storage: plain JSON files in web/data/. Used on this Mac (no NEWS_STORE set).
// Serverless hosts don't keep written files, so production uses ./cloud.ts instead.
// Both files export the same six functions; ./index.ts picks one.
const DATA_DIR = path.join(process.cwd(), "data");
const ARTICLES_FILE = path.join(DATA_DIR, "articles.json");
const SUMMARY_FILE = path.join(DATA_DIR, "summaries.json");
const HEALTH_FILE = path.join(DATA_DIR, "health.json");

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

// Per-outlet results of the latest collection run (see scripts/lib/pipeline.ts).
export async function saveHealth(report: unknown) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(HEALTH_FILE, JSON.stringify(report, null, 2));
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

// Drops summaries whose article is no longer in the collection. Returns how many were removed.
export async function pruneSummaries(keepIds: Set<string>): Promise<number> {
  const all = await loadSummaries();
  const kept: Record<string, string> = {};
  for (const [key, text] of Object.entries(all)) {
    // Keys are "<article id>:<language>".
    if (keepIds.has(key.slice(0, key.lastIndexOf(":")))) kept[key] = text;
  }
  const removed = Object.keys(all).length - Object.keys(kept).length;
  if (removed === 0) return 0;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SUMMARY_FILE, JSON.stringify(kept, null, 2));
  summaries = { mtimeMs: (await fs.stat(SUMMARY_FILE)).mtimeMs, map: kept };
  return removed;
}
