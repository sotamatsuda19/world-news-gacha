"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AboutData, AboutLight } from "@/lib/about/data";
import { startStory, type Story } from "@/lib/about/engine";
import { handOff, takeHandoff } from "@/lib/about/handoff";
import { aboutText } from "@/lib/about/text";
import { countryName, type UiLang } from "@/lib/i18n";
import { PINNED_PLACE_CHANCE, RECENT_LIMIT, useSettings } from "@/lib/settings";
import { CONTACT_URL } from "@/lib/site";
import type { DrawResult } from "@/lib/types";
import { useSummaryStream } from "@/lib/use-summary";

// The about page: a scrolling story over one canvas (lib/about/engine.ts).
//
// The letter that arrives in the middle is a real draw (/api/draw) with a real summary
// (/api/summary), but it is not kept: it never goes into the reader's letters, and the
// ids it remembers (so "another one" doesn't repeat) live only on this page.
// The summary starts only when the letter is about to arrive, so readers who never
// scroll that far cost nothing.

// Rendered only in the browser: the language comes from the reader's settings
// (localStorage), and the story needs the window's size anyway.
const subscribeNothing = () => () => {};
export default function AboutStory({ data }: { data: AboutData }) {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const { ui, summary } = useSettings();
  if (!mounted) return <div className="ab" />;
  return <Scenes key={ui} data={data} ui={ui} summaryLang={summary} />;
}

// What the letter shows. Usually a draw; if the draw fails, one of the page's own
// headlines, without a summary.
type Letter = Pick<DrawResult, "title" | "lang" | "outletName" | "countryCode" | "place"> & {
  id: string | null;
  url: string | null;
};

const toLight = (l: Letter): AboutLight => ({
  countryCode: l.countryCode,
  place: { city: l.place.city, names: l.place.names, lat: l.place.lat, lng: l.place.lng },
  title: l.title,
  lang: l.lang,
  outletName: l.outletName,
});

function Scenes({ data, ui, summaryLang }: { data: AboutData; ui: UiLang; summaryLang: string }) {
  const t = aboutText(ui, data, RECENT_LIMIT, Math.round(1 / PINNED_PLACE_CHANCE));
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const story = useRef<Story | null>(null);
  const [letter, setLetter] = useState<Letter | null>(null);
  const letterRef = useRef<Letter | null>(null);
  const recent = useRef<string[]>([]);
  const summarized = useRef<string | null>(null); // the letter whose summary was started
  const [summaryFor, setSummaryFor] = useState<string | null>(null); // the same, for rendering
  const { summary, done, start } = useSummaryStream();
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const place = useCallback(
    (l: Pick<AboutLight, "countryCode" | "place">) => `${countryName(l.countryCode, ui)} · ${l.place.names?.[ui] ?? l.place.city}`,
    [ui],
  );

  const draw = useCallback(async (): Promise<Letter | null> => {
    try {
      const res = await fetch(`/api/draw?${new URLSearchParams({ recent: recent.current.join(",") })}`);
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as DrawResult;
      recent.current = [d.id, ...recent.current].slice(0, RECENT_LIMIT);
      return { ...d };
    } catch {
      const l = data.lights[Math.floor(Math.random() * data.lights.length)];
      return l ? { ...l, place: { ...l.place, source: "ai" }, id: null, url: null } : null;
    }
  }, [data.lights]);

  // The engine runs for as long as this component is on screen.
  useEffect(() => {
    const el = root.current!;
    const q = <T extends HTMLElement>(name: string) => el.querySelector<T>(`[data-ab="${name}"]`)!;
    const all = (name: string) => [...el.querySelectorAll<HTMLElement>(`[data-ab="${name}"]`)];
    const s = startStory({
      el: {
        story: q("story"),
        stage: q("stage"),
        canvas: q<HTMLCanvasElement>("canvas"),
        hero: q("hero"),
        lines: all("line"),
        flash: q("flash"),
        flashWhere: q("flash-where"),
        flashTitle: q("flash-title"),
        letter: q("letter"),
        cue: q("cue"),
        cueAfterLetter: q("cue-after-letter"),
        recipe: q("recipe"),
        notUsed: all("not-used"),
        after: q("after"),
        end: q("end"),
        counts: all("count"),
      },
      lights: data.lights,
      label: place,
      today: t.today,
      startLng: takeHandoff("about"),
      onLetterNear: () => {
        const l = letterRef.current;
        if (l?.id && summarized.current !== l.id) {
          summarized.current = l.id;
          setSummaryFor(l.id);
          start(l.id, summaryLang);
        }
      },
    });
    story.current = s;

    let cancelled = false;
    draw().then((l) => {
      if (cancelled || !l) return;
      letterRef.current = l;
      setLetter(l);
      s.setDestination(toLight(l));
    });
    return () => {
      cancelled = true;
      s.stop();
      story.current = null;
    };
    // Started once; the texts it is given don't change while it runs (the key is the language).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function another() {
    const s = story.current;
    if (!s || busy || s.isReplaying()) return;
    setBusy(true);
    const l = await draw();
    setBusy(false);
    if (!l || !story.current) return;
    letterRef.current = l;
    s.replay(toLight(l));
    // The old letter folds away first; the new one is filled in while it is hidden.
    setTimeout(() => setLetter(l), 500);
  }

  // Back to the app: a short zoom out, then the app's globe starts from the stars.
  async function go(e: React.MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || !story.current) return; // a new tab: just open it
    e.preventDefault();
    if (leaving) return;
    setLeaving(true);
    const lng = await story.current.leave();
    handOff("app", lng);
    router.push("/");
  }

  const today = new Date();
  const br = (s: string) =>
    s.split("\n").map((part, i) => (
      <Fragment key={i}>
        {i > 0 && <br />}
        {part}
      </Fragment>
    ));
  const showSummary = letter?.id && letter.id === summaryFor;

  return (
    <div className="ab" lang={ui} ref={root} data-leaving={leaving || undefined}>
      <section className="ab-story" data-ab="story">
        <div className="ab-stage" data-ab="stage">
          <canvas className="ab-canvas" data-ab="canvas" />
          <div className="ab-hero" data-ab="hero">
            <h1>
              {t.slogan[0]}
              <br />
              {t.slogan[1]}
            </h1>
            <p>NewsGacha</p>
          </div>

          {t.lines.map((line, i) => (
            <div className="ab-say" data-ab="line" key={i}>
              <h2>
                {line.no && <span className="ab-no">{line.no}</span>}
                {br(line.h)}
              </h2>
              {line.p && <p>{br(line.p)}</p>}
            </div>
          ))}

          <div className="ab-flash" data-ab="flash">
            <div className="ab-flash-where" data-ab="flash-where" />
            <div className="ab-flash-title" data-ab="flash-title" dir="auto" />
          </div>

          <article className="ab-letter" data-ab="letter">
            {letter && (
              <>
                <div className="ab-stamp" aria-hidden>
                  <b>{letter.countryCode.toUpperCase()}</b>
                  <small>{`${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`}</small>
                </div>
                <div className="ab-letter-where">
                  {place(letter)} {t.received}
                </div>
                <div className="ab-letter-title" lang={letter.lang} dir="auto">
                  {letter.title}
                </div>
                {showSummary && (
                  <div className="ab-letter-summary" lang={summaryLang} data-loading={!summary && !done ? "" : undefined}>
                    {summary}
                  </div>
                )}
                <div className="ab-letter-acts">
                  {letter.url ? (
                    <a href={letter.url} target="_blank" rel="noopener noreferrer">
                      {t.original}
                    </a>
                  ) : (
                    <span />
                  )}
                  <button type="button" onClick={another} disabled={busy}>
                    {t.again}
                  </button>
                </div>
              </>
            )}
          </article>

          <div className="ab-recipe" data-ab="recipe">
            <h2>{t.recipeTitle}</h2>
            <div className="ab-pairs">
              <h3 className="ab-use">{t.use}</h3>
              <h3 className="ab-not">{t.not}</h3>
              {t.pairs.map((pair, i) => (
                <Fragment key={i}>
                  <div className="ab-use">
                    {pair.use}
                    <small>{pair.useNote}</small>
                  </div>
                  <div className="ab-not" data-ab="not-used">
                    {pair.not}
                    <small>{pair.notNote}</small>
                  </div>
                </Fragment>
              ))}
            </div>
            <p className="ab-after" data-ab="after">
              {t.after[0]}
              <br />
              {t.after[1]}
            </p>
          </div>

          <div className="ab-end" data-ab="end">
            <h2>{t.endTitle}</h2>
            <div className="ab-nums">
              {[data.countries, data.outlets, data.articles].map((n, i) => (
                <div key={i}>
                  <b data-ab="count" data-to={n}>
                    0
                  </b>
                  <span>{t.countLabels[i]}</span>
                </div>
              ))}
            </div>
            <Link className="ab-go" href="/" onClick={go}>
              {t.go}
            </Link>
          </div>

          <div className="ab-cue" data-ab="cue" aria-hidden>
            <span>
              <i />
              <em>scroll</em>
            </span>
          </div>
          <div className="ab-cue ab-cue-again" data-ab="cue-after-letter" aria-hidden>
            <span>
              <i />
              <em>scroll</em>
            </span>
          </div>
        </div>
      </section>

      {/* The story is long: a way back from anywhere in it. */}
      <Link className="ab-back" href="/" onClick={go}>
        <span aria-hidden>←</span> {t.back}
      </Link>

      <footer className="ab-footer">
        <Link href="/terms">{t.terms}</Link>
        <Link href="/publishers">{t.publishers}</Link>
        <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">
          {t.contact}
        </a>
      </footer>
    </div>
  );
}
