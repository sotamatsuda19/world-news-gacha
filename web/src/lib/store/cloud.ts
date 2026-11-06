import { get, put } from "@vercel/blob";
import { Redis } from "@upstash/redis";
import type { Article } from "../types";

// Production storage (NEWS_STORE=cloud). Same six functions as ./file.ts.
//
// - Articles and the health report: Vercel Blob, a file store. The daily collection
//   (GitHub Actions) overwrites articles.json once; the site only reads it.
//   Needs BLOB_READ_WRITE_TOKEN.
// - Summaries: Upstash Redis, a key-value database. Many small writes, one per
//   "article + language", each deleted automatically after a few days.
//   Needs UPSTASH_REDIS_REST_URL / _TOKEN (or KV_REST_API_URL / _TOKEN, the names
//   Vercel's Storage tab sets). Only the site uses Redis; the collector doesn't.

const ARTICLES = "articles.json";
const HEALTH = "health.json";
// The store is private: files are read with the token, never by public URL.
const BLOB_OPTIONS = {
  access: "private",
  addRandomSuffix: false, // keep the name "articles.json" so it can be overwritten
  allowOverwrite: true,
  contentType: "application/json",
  cacheControlMaxAge: 60, // after an overwrite, Vercel's cache serves the old file for at most a minute
} as const;

// --- Articles -------------------------------------------------------------

// One server instance keeps the articles in memory and asks Blob at most every
// 10 minutes whether the file changed (collection runs once a day, so a few
// minutes' delay doesn't matter). The ETag is the file's fingerprint: if it is
// unchanged, Blob answers "304 Not Modified" without sending the 2.5 MB again.
const RECHECK_MS = 10 * 60 * 1000;
let articlesCache: { etag: string; checkedAt: number; articles: Article[] } | null = null;

export async function loadArticles(): Promise<Article[]> {
  if (articlesCache && Date.now() - articlesCache.checkedAt < RECHECK_MS) return articlesCache.articles;

  const res = await get(ARTICLES, { access: "private", ifNoneMatch: articlesCache?.etag });
  if (!res) return []; // nothing collected yet
  if (res.statusCode === 304) {
    if (!articlesCache) return [];
    articlesCache.checkedAt = Date.now();
    return articlesCache.articles;
  }
  const parsed = JSON.parse(await new Response(res.stream).text()) as { articles: Article[] };
  articlesCache = { etag: res.blob.etag, checkedAt: Date.now(), articles: parsed.articles };
  return parsed.articles;
}

export async function saveArticles(articles: Article[]) {
  await put(ARTICLES, JSON.stringify({ collectedAt: new Date().toISOString(), articles }), BLOB_OPTIONS);
}

export async function saveHealth(report: unknown) {
  await put(HEALTH, JSON.stringify(report, null, 2), BLOB_OPTIONS);
}

// --- Summaries ------------------------------------------------------------

// Articles stay in the draw for at most about 3 days (published within 48 hours,
// collected daily), so a summary is never needed after 4.
const SUMMARY_TTL_SECONDS = 4 * 24 * 60 * 60;

// Created on first use, so importing this file without Redis settings (on this Mac) is fine.
let redis: Redis | null = null;
function db() {
  // automaticDeserialization: false — store and return the text exactly as written.
  return (redis ??= Redis.fromEnv({ automaticDeserialization: false }));
}
const key = (id: string, lang: string) => `summary:${id}:${lang}`;

// The summaries are a cache: if Redis fails, the letter still gets written (just
// not saved), so errors are logged instead of breaking the request.
export async function getSummary(id: string, lang: string): Promise<string | undefined> {
  try {
    return (await db().get<string>(key(id, lang))) ?? undefined;
  } catch (error) {
    console.error("summary cache: read failed", error);
    return undefined;
  }
}

export async function putSummary(id: string, lang: string, text: string) {
  try {
    await db().set(key(id, lang), text, { ex: SUMMARY_TTL_SECONDS });
  } catch (error) {
    console.error("summary cache: write failed", error);
  }
}

// Old summaries expire by themselves (SUMMARY_TTL_SECONDS), so there is nothing to prune.
// (Same signature as file.ts's, so either can be used in its place.)
export async function pruneSummaries(keepIds: Set<string>): Promise<number> {
  void keepIds;
  return 0;
}
