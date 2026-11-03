"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ArticleImage, DrawResult } from "@/lib/types";
import { baseLang, uiStrings } from "@/lib/i18n";
import GlobeView, { type GlobeHandle } from "./GlobeView";
import Envelope from "./Envelope";
import LetterCard from "./LetterCard";

// idle ─button─▶ spinning ─stops─▶ landing (zoom + flash) ─▶ envelope ─open─▶ card ─close─▶ idle
type Phase = "idle" | "spinning" | "landing" | "envelope" | "card";

const SPIN_MS = 3600;
const ZOOM_MS = 750;
const RECENT_LIMIT = 12;
const IMAGE_WAIT_MS = 1200; // after landing, wait at most this long for the photo check
const READY_TIMEOUT_MS = 10000; // show the globe anyway if the ready signal never comes

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Loads a photo the same way the card will (no Referer). Resolves false if it fails.
function preload(img: ArticleImage | null): Promise<boolean> {
  if (!img) return Promise.resolve(false);
  return new Promise((resolve) => {
    const el = new Image();
    el.referrerPolicy = "no-referrer";
    el.onload = () => resolve(true);
    el.onerror = () => resolve(false);
    el.src = img.url;
  });
}

// Decides the photo while the globe spins: the article's own photo if it loads,
// otherwise the free-license photo of the place, otherwise none.
async function pickImage(a: DrawResult): Promise<ArticleImage | null> {
  if (await preload(a.image)) return a.image;
  if (await preload(a.fallbackImage)) return a.fallbackImage;
  return null;
}

export default function GachaApp() {
  const globe = useRef<GlobeHandle>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [article, setArticle] = useState<DrawResult | null>(null);
  const [image, setImage] = useState<ArticleImage | null>(null);
  const [landingPoint, setLandingPoint] = useState<{ x: number; y: number } | null>(null);
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
  const onGlobeReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), READY_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

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
        // EventSource would reconnect forever (and replay the summary); stop it.
        setSummaryDone(true);
        es.close();
      };
      stream.current = es;
    },
    [lang],
  );

  const draw = async () => {
    if (phase !== "idle" || !ready) return;
    setError(false);
    setPhase("spinning");
    try {
      const res = await fetch(`/api/draw?recent=${recent.current.join(",")}`);
      if (!res.ok) throw new Error(`draw failed: ${res.status}`);
      const picked = (await res.json()) as DrawResult;
      recent.current = [picked.id, ...recent.current].slice(0, RECENT_LIMIT);
      setArticle(picked);
      startSummary(picked.id);
      const imageChoice = pickImage(picked); // runs during the spin

      const { lat, lng } = picked.place;
      await globe.current?.spinTo(lat, lng, SPIN_MS);

      // The "it's here!" moment: zoom in while the spot flares up.
      globe.current?.showMarker(lat, lng);
      setLandingPoint(globe.current?.screenPoint(lat, lng) ?? null);
      setPhase("landing");
      await globe.current?.zoomIn(ZOOM_MS);
      setLandingPoint(globe.current?.screenPoint(lat, lng) ?? null);

      // Usually decided long ago; if the photo is slow, don't hold the envelope for it.
      setImage(await Promise.race([imageChoice, wait(IMAGE_WAIT_MS).then(() => picked.image ?? picked.fallbackImage)]));
      setPhase("envelope");
    } catch (e) {
      console.error(e);
      setError(true);
      globe.current?.clearMarker();
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
      <GlobeView ref={globe} onReady={onGlobeReady} />

      {phase === "landing" && landingPoint && (
        <div className="landing-flash" style={{ left: landingPoint.x, top: landingPoint.y }} />
      )}

      {phase === "envelope" && <Envelope hint={t.open} origin={landingPoint} onOpened={() => setPhase("card")} />}

      {phase === "card" && article && (
        <LetterCard
          article={article}
          initialImage={image}
          summary={summary}
          summaryDone={summaryDone}
          uiLang={lang}
          t={t}
          onClose={close}
        />
      )}

      <div className="gacha-dock" data-hidden={phase !== "idle" || !ready || undefined}>
        {error && <p className="gacha-error">{t.error}</p>}
        <button type="button" className="gacha-button" onClick={draw} aria-label={t.draw}>
          <span className="gacha-button-core" />
        </button>
        <p className="gacha-caption">{t.caption}</p>
      </div>

      <div className="loading-screen" data-done={ready || undefined} aria-hidden={ready}>
        <span className="loading-orb" />
        <p className="loading-text">{t.loading}</p>
      </div>
    </main>
  );
}
