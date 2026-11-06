import Anthropic from "@anthropic-ai/sdk";
import { after, type NextRequest } from "next/server";
import { getSummary, loadArticles, putSummary } from "@/lib/store";
import type { Article } from "@/lib/types";
import { baseLang } from "@/lib/i18n";
import { summaryRequest, tidyLineBreaks } from "@/lib/summary-prompt";

const client = new Anthropic();

// A summary being generated right now. Requests for the same article and language
// all listen to the same job instead of each calling the model.
// (In-memory: fine for one server process. With several servers, this needs a
// shared lock, e.g. a "pending" row in the database.)
type Job = { chunks: string[]; done: boolean; listeners: Set<() => void> };
const inflight = new Map<string, Job>();

function startJob(key: string, article: Article, lang: string): Job {
  const job: Job = { chunks: [], done: false, listeners: new Set() };
  const push = (t: string) => {
    job.chunks.push(t);
    job.listeners.forEach((l) => l());
  };
  const end = () => {
    job.done = true;
    job.listeners.forEach((l) => l());
    inflight.delete(key);
  };
  inflight.set(key, job);

  // Runs to the end even if the first listener disconnects, so the result still gets cached.
  // On a serverless host (Vercel) the function may be frozen as soon as the response
  // ends, e.g. when the reader closes the letter early. after() tells the host to keep
  // it running until this promise settles.
  const work = (async () => {
    // Without an API key, fall back to the feed's own description so the UI still works.
    if (!process.env.ANTHROPIC_API_KEY) {
      push(article.description || article.title);
      return end();
    }

    let text = "";
    try {
      // The model, instructions and message live in src/lib/summary-prompt.ts.
      const stream = client.messages.stream(summaryRequest(article, lang));
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const piece = tidyLineBreaks(event.delta.text, /\n\s*$/.test(text) || !text.trim());
          if (!piece) continue;
          text += piece;
          push(piece);
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") {
        if (!text) push(article.description || article.title);
      } else if (text.trim()) {
        await putSummary(article.id, lang, text.trim());
      }
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) console.error("summary: rate limited");
      else if (error instanceof Anthropic.APIError) console.error(`summary: API error ${error.status}`, error.message);
      else console.error("summary failed", error);
      if (!text) push(article.description || article.title);
    }
    end();
  })();
  after(() => work);

  return job;
}

function sse(event: string | null, data: unknown) {
  return `${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(data)}\n\n`;
}

// Streams a short summary in the reader's language as Server-Sent Events.
// Generated only when someone actually draws the article, then cached.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const lang = baseLang(req.nextUrl.searchParams.get("lang") ?? "en");
  const article = (await loadArticles()).find((a) => a.id === id);
  if (!article) return new Response("not found", { status: 404 });

  const cached = await getSummary(id, lang);
  const key = `${id}:${lang}`;
  const job: Job = cached
    ? { chunks: [cached], done: true, listeners: new Set() }
    : (inflight.get(key) ?? startJob(key, article, lang));

  const encoder = new TextEncoder();
  let listener: (() => void) | null = null;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let sent = 0;
      // Send whatever the job has produced since last time; replays earlier chunks
      // for a listener that joined late.
      listener = () => {
        while (sent < job.chunks.length) {
          controller.enqueue(encoder.encode(sse(null, { t: job.chunks[sent++] })));
        }
        if (job.done) {
          controller.enqueue(encoder.encode(sse("done", {})));
          controller.close();
          job.listeners.delete(listener!);
        }
      };
      job.listeners.add(listener);
      listener();
    },
    cancel() {
      if (listener) job.listeners.delete(listener);
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
