import { useCallback, useEffect, useRef, useState } from "react";

// Streams an article's summary from /api/summary (Server-Sent Events) into React state.
// Browser only. `start` begins a new stream (closing any previous one); `stop` ends it.
export function useSummaryStream() {
  const [summary, setSummary] = useState("");
  const [done, setDone] = useState(false);
  const stream = useRef<EventSource | null>(null);

  const stop = useCallback(() => {
    stream.current?.close();
    stream.current = null;
  }, []);

  const start = useCallback(
    (id: string, lang: string) => {
      stop();
      setSummary("");
      setDone(false);
      const es = new EventSource(`/api/summary?id=${encodeURIComponent(id)}&lang=${lang}`);
      // Each message is JSON ({ t: "..." }) because summaries contain line breaks,
      // which would otherwise end an SSE message early.
      es.onmessage = (e) => setSummary((s) => s + (JSON.parse(e.data) as { t: string }).t);
      es.addEventListener("done", () => {
        setDone(true);
        es.close();
      });
      es.onerror = () => {
        // EventSource would reconnect forever (and replay the summary); stop it.
        setDone(true);
        es.close();
      };
      stream.current = es;
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { summary, done, start, stop };
}
