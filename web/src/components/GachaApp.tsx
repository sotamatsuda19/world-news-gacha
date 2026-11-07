"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { handOff } from "@/lib/about/handoff";
import type { ArticleImage, DrawResult } from "@/lib/types";
import { uiStrings } from "@/lib/i18n";
import { PINNED_PLACE_CHANCE, MAX_PLACES, RECENT_LIMIT, roundForRequest, updateSettings, useSettings } from "@/lib/settings";
import { groupLetters, lettersStore, saveLetter, setLetterSummary, type Letter, type LetterLight } from "@/lib/letters";
import { playLanding, playSample, playZoom, setSoundEnabled, startWind, unlockAudio } from "@/lib/sound";
import { useSummaryStream } from "@/lib/use-summary";
import GlobeView, { type GlobeHandle, type GlobeLight } from "./GlobeView";
import Envelope from "./Envelope";
import LetterCard from "./LetterCard";
import LetterList from "./LetterList";
import SettingsPanel, { SettingsButton } from "./SettingsPanel";

// idle ─button / long press─▶ spinning ─stops─▶ landing (zoom + flash) ─▶ envelope ─open─▶ card ─close─▶ idle
// While idle, the reader can also tap a light (re-read), open the settings, or pin places.
type Phase = "idle" | "spinning" | "landing" | "envelope" | "card";

// What is open on top of the idle globe.
type Overlay =
  | { kind: "list"; letters: Letter[] }
  | { kind: "letter"; letter: Letter }
  | { kind: "settings" }
  | { kind: "pinning" }
  | null;

const SPIN_MS = 3600;
const ZOOM_MS = 750;
const RIPPLE_MS = 450; // after a long press, let the ripple show before turning
const IMAGE_WAIT_MS = 1200; // after landing, wait at most this long for the photo check
const READY_TIMEOUT_MS = 10000; // show the globe anyway if the ready signal never comes
const SHAKE_MS = 320;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

const pinKey = (p: { lat: number; lng: number }) => `pin:${p.lat},${p.lng}`;

// A short spin takes longer the farther it goes, within limits.
function shortSpinMs(from: { lat: number; lng: number } | null, to: { lat: number; lng: number }) {
  if (!from) return 1300;
  const dLng = Math.abs(((to.lng - from.lng + 540) % 360) - 180);
  return Math.min(1700, 900 + 6 * (dLng + Math.abs(to.lat - from.lat)));
}

export default function GachaApp() {
  const globe = useRef<GlobeHandle>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [article, setArticle] = useState<DrawResult | null>(null);
  const [image, setImage] = useState<ArticleImage | null>(null);
  const [landingPoint, setLandingPoint] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [leaving, setLeaving] = useState(false); // flying out to the about page
  const router = useRouter();
  const settings = useSettings();
  const letters = lettersStore.use();
  const live = useSummaryStream(); // the summary of the letter being delivered
  const reread = useSummaryStream(); // only for re-reading a letter saved without one
  const recent = useRef<string[]>([]);

  const t = uiStrings(settings.ui);
  // (The globe is made again when this page is shown again, e.g. back from /about:
  // that is also when the "leaving" state ends.)
  const onGlobeReady = useCallback(() => {
    setReady(true);
    setLeaving(false);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), READY_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);

  // The lights on the globe (where letters came from) and the pinned places.
  const lights = useMemo<GlobeLight[]>(() => {
    const fromLetters = groupLetters(letters).map((l: LetterLight) => ({
      key: l.key,
      lat: l.lat,
      lng: l.lng,
      count: l.letters.length,
      kind: "letter" as const,
    }));
    // Keyed by place, not by position in the list: removing one pin must not
    // re-key (and re-drop) the others.
    const pins = settings.places.map((p) => ({ key: pinKey(p), lat: p.lat, lng: p.lng, count: 1, kind: "pin" as const }));
    return [...fromLetters, ...pins];
  }, [letters, settings.places]);
  useEffect(() => {
    if (ready) globe.current?.setLights(lights);
  }, [lights, ready]);

  // Save the letter when it is opened, and fill in its summary when that finishes
  // (the summary may still be streaming while the card is already up).
  useEffect(() => {
    if (phase === "card" && article && live.done) setLetterSummary(article.id, live.summary, settings.summary);
  }, [phase, article, live.done, live.summary, settings.summary]);

  // ---------- Drawing ----------

  const deliver = async (near: { lat: number; lng: number } | null, fromPress: boolean) => {
    if (phase !== "idle" || !ready) return;
    unlockAudio();
    setError(false);
    setOverlay(null);
    setPhase("spinning");
    if (fromPress && near) globe.current?.showMarker(near.lat, near.lng); // the ripple where the finger was

    // Now and then, a letter from near one of the reader's pinned places. Decided
    // here in the browser: the server only ever sees a rounded point.
    let point = near;
    if (!point && settings.places.length > 0 && Math.random() < PINNED_PLACE_CHANCE) {
      point = settings.places[Math.floor(Math.random() * settings.places.length)];
    }
    const params = new URLSearchParams({ recent: recent.current.join(",") });
    if (point) {
      const r = roundForRequest(point);
      params.set("near", `${r.lat},${r.lng}`);
    }

    try {
      const [res] = await Promise.all([fetch(`/api/draw?${params}`), fromPress ? wait(RIPPLE_MS) : null]);
      if (!res.ok) throw new Error(`draw failed: ${res.status}`);
      const picked = (await res.json()) as DrawResult;
      recent.current = [picked.id, ...recent.current].slice(0, RECENT_LIMIT);
      setArticle(picked);
      live.start(picked.id, settings.summary); // generating while the globe spins hides the wait
      const imageChoice = pickImage(picked);

      const { lat, lng } = picked.place;
      const wind = startWind();
      await globe.current?.spinTo(lat, lng, {
        // A long press already chose the region: a short turn, no wind-up.
        durationMs: fromPress ? shortSpinMs(near, picked.place) : SPIN_MS,
        turns: fromPress ? 0 : 2,
        anticipate: !fromPress && !reducedMotion(),
        onSpeed: wind.setSpeed,
      });
      wind.stop();

      // The "it's here!" moment: a thud, a small shake, then zoom in while the spot flares up.
      playLanding();
      setShaking(true);
      setTimeout(() => setShaking(false), SHAKE_MS);
      globe.current?.showMarker(lat, lng);
      setLandingPoint(globe.current?.screenPoint(lat, lng) ?? null);
      setPhase("landing");
      playZoom(ZOOM_MS);
      await globe.current?.zoomIn(ZOOM_MS);
      setLandingPoint(globe.current?.screenPoint(lat, lng) ?? null);

      // Usually decided long ago; if the photo is slow, don't hold the envelope for it.
      setImage(await Promise.race([imageChoice, wait(IMAGE_WAIT_MS).then(() => picked.image ?? picked.fallbackImage)]));
      playSample("envelope", 0.35); // it settles about a third of a second into its flight
      setPhase("envelope");
    } catch (e) {
      console.error(e);
      setError(true);
      globe.current?.clearMarker();
      globe.current?.idle();
      setPhase("idle");
    }
  };

  const openCard = () => {
    if (!article) return;
    playSample("unfold");
    saveLetter(article, image, live.done ? live.summary : "", settings.summary);
    setPhase("card");
  };

  const closeCard = () => {
    live.stop();
    globe.current?.clearMarker();
    globe.current?.idle();
    setArticle(null);
    setPhase("idle");
  };

  // ---------- To the about page ----------

  // From the letter ("how was this letter chosen?") or from settings: put everything
  // away, pull back into the stars, and let the about page start from there.
  const goAbout = async () => {
    if (leaving) return;
    setLeaving(true);
    live.stop();
    reread.stop();
    globe.current?.clearMarker();
    setArticle(null);
    setPhase("idle");
    setOverlay(null);
    const lng = await globe.current?.zoomOut(1600);
    if (lng !== undefined) handOff("about", lng);
    router.push("/about");
  };

  // ---------- The idle globe: lights, long press, pins ----------

  const onLightClick = (light: GlobeLight) => {
    if (phase !== "idle") return;
    if (light.kind === "pin") {
      // Tapping a pin while placing pins removes it.
      if (overlay?.kind === "pinning") updateSettings({ places: settings.places.filter((p) => pinKey(p) !== light.key) });
      return;
    }
    if (overlay) return;
    const group = groupLetters(letters).find((l) => l.key === light.key);
    if (!group) return;
    if (group.letters.length === 1) openSaved(group.letters[0]);
    else setOverlay({ kind: "list", letters: group.letters });
  };

  const openSaved = (letter: Letter) => {
    unlockAudio();
    playSample("unfold");
    // Saved before its summary arrived (closed early): ask again, while the server still has it.
    if (!letter.summary) reread.start(letter.id, letter.summaryLang);
    setOverlay({ kind: "letter", letter });
  };

  // Fill a re-read letter's missing summary in once it arrives.
  useEffect(() => {
    if (overlay?.kind === "letter" && !overlay.letter.summary && reread.done) {
      setLetterSummary(overlay.letter.id, reread.summary, overlay.letter.summaryLang);
    }
  }, [overlay, reread.done, reread.summary]);

  const onLongPress = (point: { lat: number; lng: number }) => {
    if (overlay?.kind === "pinning") {
      unlockAudio();
      playSample("slide");
      const places = [...settings.places, point].slice(0, MAX_PLACES);
      updateSettings({ places });
      if (places.length >= MAX_PLACES) setOverlay({ kind: "settings" });
      return;
    }
    if (!overlay) void deliver(point, true);
  };

  const idle = phase === "idle";
  const pressable = ready && idle && (!overlay || overlay.kind === "pinning");

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-[#02030a] select-none no-callout"
      data-shaking={shaking || undefined}
      // Tap anywhere while spinning to skip straight to the landing.
      onClick={() => phase === "spinning" && globe.current?.skip()}
    >
      <GlobeView
        ref={globe}
        onReady={onGlobeReady}
        onLongPress={onLongPress}
        pressable={pressable}
        onLightClick={onLightClick}
        pinsTappable={overlay?.kind === "pinning"}
      />

      {phase === "landing" && landingPoint && (
        <div className="landing-flash" style={{ left: landingPoint.x, top: landingPoint.y }} />
      )}

      {phase === "envelope" && <Envelope hint={t.open} origin={landingPoint} onOpened={openCard} />}

      {phase === "card" && article && (
        <LetterCard
          content={article}
          initialImage={image}
          summary={live.summary}
          summaryDone={live.done}
          summaryLang={settings.summary}
          t={t}
          onClose={closeCard}
          onAbout={goAbout}
        />
      )}

      {idle && overlay?.kind === "letter" && (
        <LetterCard
          key={overlay.letter.id}
          content={{ ...overlay.letter, fallbackImage: null }}
          initialImage={overlay.letter.image}
          summary={overlay.letter.summary || reread.summary}
          summaryDone={!!overlay.letter.summary || reread.done}
          summaryLang={overlay.letter.summaryLang}
          instant={!!overlay.letter.summary}
          t={t}
          onClose={() => {
            reread.stop();
            setOverlay(null);
          }}
        />
      )}

      {idle && overlay?.kind === "list" && (
        <LetterList
          letters={overlay.letters}
          uiLang={settings.ui}
          t={t}
          onOpen={openSaved}
          onClose={() => setOverlay(null)}
        />
      )}

      {idle && overlay?.kind === "settings" && (
        <SettingsPanel
          settings={settings}
          letterCount={letters.length}
          t={t}
          onAddPlace={() => setOverlay({ kind: "pinning" })}
          onAbout={goAbout}
          onClose={() => setOverlay(null)}
        />
      )}

      {idle && overlay?.kind === "pinning" && (
        <div className="pin-banner">
          <p>{t.pinHint}</p>
          <button type="button" onClick={() => setOverlay({ kind: "settings" })}>
            {t.done}
          </button>
        </div>
      )}

      <SettingsButton
        label={t.settings}
        hidden={!ready || !idle || !!overlay || leaving}
        onClick={() => {
          unlockAudio();
          setOverlay({ kind: "settings" });
        }}
      />

      <div className="gacha-dock" data-hidden={!idle || !ready || !!overlay || leaving || undefined}>
        {error && <p className="gacha-error">{t.error}</p>}
        <button type="button" className="gacha-button" onClick={() => deliver(null, false)} aria-label={t.draw}>
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
