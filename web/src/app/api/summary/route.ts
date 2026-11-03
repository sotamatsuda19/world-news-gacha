import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { getSummary, loadArticles, putSummary } from "@/lib/store";
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

function sse(event: string | null, data: unknown) {
  return `${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(data)}\n\n`;
}

// Streams a 3-line summary in the reader's language as Server-Sent Events.
// Generated only when someone actually draws the article, then cached.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const lang = baseLang(req.nextUrl.searchParams.get("lang") ?? "en");
  const article = (await loadArticles()).find((a) => a.id === id);
  if (!article) return new Response("not found", { status: 404 });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string | null, data: unknown) => controller.enqueue(encoder.encode(sse(event, data)));
      const finish = () => {
        send("done", {});
        controller.close();
      };

      const cached = await getSummary(id, lang);
      if (cached) {
        send(null, { t: cached });
        return finish();
      }

      // Without an API key, fall back to the feed's own description so the UI still works.
      if (!process.env.ANTHROPIC_API_KEY) {
        send(null, { t: article.description || article.title });
        return finish();
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
            send(null, { t: event.delta.text });
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          send(null, { t: text ? "" : article.description || article.title });
        } else if (text.trim()) {
          await putSummary(id, lang, text.trim());
        }
      } catch (error) {
        if (error instanceof Anthropic.RateLimitError) console.error("summary: rate limited");
        else if (error instanceof Anthropic.APIError) console.error(`summary: API error ${error.status}`, error.message);
        else console.error("summary failed", error);
        if (!text) send(null, { t: article.description || article.title });
      }
      finish();
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
