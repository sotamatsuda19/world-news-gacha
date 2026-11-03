import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { getSummary, loadArticles, putSummary } from "@/lib/store";
import type { Article } from "@/lib/types";
import { baseLang } from "@/lib/i18n";

const MODEL = "claude-haiku-5-5";

const SYSTEM = `You write the short note inside a "news letter" that arrives from somewhere in the world.
The reader sees the original headline (possibly in a language they cannot read) and then your note.
Write two or three short lines in the reader's language, one sentence per line, separated by single line breaks.
Keep each line short: about 15 words, or about 35 characters in Japanese, Chinese or Korean.
- what happened, in plain words;
- the key detail (a number, a name, a place);
- only if the text itself says so: what happens next or why it matters there.
Use only facts in the headline and description. Never speculate, never comment on the reporting itself ("it was reported as..."), and never add filler such as "this is drawing attention". If the text supports only two lines, write two.
Keep abbreviations you are not sure about as they are instead of guessing what they stand for.
Plain text only: no markdown, no bullets, no blank lines, no quotation of the full headline.`;

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
  void (async () => {
    // Without an API key, fall back to the feed's own description so the UI still works.
    if (!process.env.ANTHROPIC_API_KEY) {
      push(article.description || article.title);
      return end();
    }

    const readerLanguage = new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? lang;
    let text = "";
    try {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 600,
        // A three-line note doesn't need reasoning; skipping it keeps the first token fast.
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              `Reader's language: ${readerLanguage}`,
              `Place: ${article.place.city}${article.place.region ? `, ${article.place.region}` : ""}, ${article.country}`,
              `Outlet: ${article.outletName}`,
              `Headline: ${article.title}`,
              `Description: ${article.description || "(none)"}`,
            ].join("\n"),
          },
        ],
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          text += event.delta.text;
          push(event.delta.text);
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
