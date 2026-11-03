"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { DrawResult } from "@/lib/types";
import { baseLang, uiStrings } from "@/lib/i18n";
import GlobeView, { type GlobeHandle } from "./GlobeView";
import Envelope from "./Envelope";
import LetterCard from "./LetterCard";

type Phase = "idle" | "spinning" | "landed" | "envelope" | "card";

const SPIN_MS = 3600;
const LANDED_PAUSE_MS = 650;
const RECENT_LIMIT = 12;

export default function GachaApp() {
  const globe = useRef<GlobeHandle>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [article, setArticle] = useState<DrawResult | null>(null);
  const [summary, setSummary] = useState("");
  const [summaryDone, setSummaryDone] = useState(false);
  const [error, setError] = useState(false);
  // Browser language, read without a hydration mismatch ("en" on the server).
  const lang = useSyncExternalStore(
    () => () => {},
    () => baseLang(navigator.language),
    () => "en",
  );
  const recent = useRef<string[]>([]);
  const stream = useRef<EventSource | null>(null);

  const t = uiStrings(lang);

  // The summary starts generating the moment the button is pressed, so the
  // spin and the envelope hide the model's latency.
  const startSummary = useCallback(
    (id: string) => {
      stream.current?.close();
      setSummary("");
      setSummaryDone(false);
      const es = new EventSource(`/api/summary?id=${encodeURIComponent(id)}&lang=${lang}`);
      es.onmessage = (e) => setSummary((s) => s + (JSON.parse(e.data) as { t: string }).t);
      es.addEventListener("done", () => {
        setSummaryDone(true);
        es.close();
      });
      es.onerror = () => {
        setSummaryDone(true);
        es.close();
      };
      stream.current = es;
    },
    [lang],
  );

  const draw = async () => {
    if (phase !== "idle") return;
    setError(false);
    setPhase("spinning");
    try {
      const res = await fetch(`/api/draw?recent=${recent.current.join(",")}`);
      if (!res.ok) throw new Error(`draw failed: ${res.status}`);
      const picked = (await res.json()) as DrawResult;
      recent.current = [picked.id, ...recent.current].slice(0, RECENT_LIMIT);
      setArticle(picked);
      startSummary(picked.id);

      await globe.current?.spinTo(picked.place.lat, picked.place.lng, SPIN_MS);
      globe.current?.showMarker(picked.place.lat, picked.place.lng);
      setPhase("landed");
      setTimeout(() => setPhase("envelope"), LANDED_PAUSE_MS);
    } catch (e) {
      console.error(e);
      setError(true);
      globe.current?.idle();
      setPhase("idle");
    }
  };

  const close = () => {
    stream.current?.close();
    globe.current?.clearMarker();
    globe.current?.idle();
    setArticle(null);
    setPhase("idle");
  };

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-[#02030a] select-none"
      // Tap anywhere while spinning to skip straight to the landing.
      onClick={() => phase === "spinning" && globe.current?.skip()}
    >
      <GlobeView ref={globe} />

      {phase === "envelope" && <Envelope hint={t.open} onOpened={() => setPhase("card")} />}

      {phase === "card" && article && (
        <LetterCard
          article={article}
          summary={summary}
          summaryDone={summaryDone}
          uiLang={lang}
          t={t}
          onClose={close}
        />
      )}

      <div className="gacha-dock" data-hidden={phase !== "idle" || undefined}>
        {error && <p className="gacha-error">{t.error}</p>}
        <button type="button" className="gacha-button" onClick={draw} aria-label="Draw a letter">
          <span className="gacha-button-core" />
        </button>
      </div>
    </main>
  );
}
