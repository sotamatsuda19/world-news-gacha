"use client";

import { useState } from "react";
import type { ArticleImage, DrawResult } from "@/lib/types";
import { countryName, type UiStrings } from "@/lib/i18n";
import { playSample } from "@/lib/sound";
import Typewriter from "./Typewriter";

// Languages written in wide characters carry more per character, so type them slower.
const WIDE_SCRIPT = /^(ja|zh|ko)/;

// What the card needs. A fresh draw (DrawResult) has it; so does a saved letter.
export type CardContent = Pick<DrawResult, "title" | "url" | "outletName" | "countryCode" | "lang" | "fallbackImage"> & {
  place: { city: string; names?: Record<string, string> };
};

// The letter's contents. Place, headline and photo rise first; the AI summary
// types itself out underneath (or appears at once when re-reading).
// (The "unfold" sound is played by whoever opens the card, in the same event.)
export default function LetterCard({
  content,
  initialImage,
  summary,
  summaryDone,
  summaryLang,
  instant = false,
  t,
  onClose,
  onAbout,
}: {
  content: CardContent;
  initialImage: ArticleImage | null; // already preloaded while the globe was spinning
  summary: string;
  summaryDone: boolean;
  summaryLang: string; // the place line and the summary are in this language
  instant?: boolean; // re-reading: show the summary at once, no typing
  t: UiStrings;
  onClose: () => void;
  onAbout?: () => void; // shows "how was this letter chosen?" once the summary has typed out
}) {
  // Safety net: if the photo fails here, drop to the place photo, then to none.
  const [image, setImage] = useState(initialImage);
  // The AI note under the card appears only once the summary has finished typing,
  // so it doesn't compete with the letter arriving.
  const [typed, setTyped] = useState(false);
  const city = content.place.names?.[summaryLang] ?? content.place.names?.en ?? content.place.city;

  const close = () => {
    playSample("fold");
    onClose();
  };

  return (
    <div className="card-stage" onClick={close}>
      <article className="letter-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="card-close" onClick={close} aria-label={t.close}>
          ×
        </button>

        {image && (
          <div className="card-photo rise" style={{ animationDelay: "0ms" }}>
            <a href={content.url} target="_blank" rel="noopener noreferrer" tabIndex={-1}>
              {/* Plain <img>: the browser loads it straight from the publisher, never via our server. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setImage(image.source === "ogp" ? content.fallbackImage : null)}
              />
            </a>
            {image.source === "fallback" && image.credit && (
              <a className="photo-credit" href={image.creditUrl} target="_blank" rel="noopener noreferrer">
                {t.photo}: {image.credit}
              </a>
            )}
          </div>
        )}

        <div className="card-body">
          <p className="card-place rise" style={{ animationDelay: "120ms" }}>
            <span className={`fi fi-${content.countryCode} card-flag`} aria-hidden />
            <span>{countryName(content.countryCode, summaryLang)}</span>
            <span className="card-dot">·</span>
            <span>{city}</span>
          </p>

          <h2 className="card-headline rise" lang={content.lang} dir="auto" style={{ animationDelay: "240ms" }}>
            {content.title}
          </h2>

          <div className="card-summary rise" style={{ animationDelay: "520ms" }}>
            <Typewriter
              text={summary}
              done={summaryDone}
              lang={summaryLang}
              instant={instant}
              msPerChar={WIDE_SCRIPT.test(summaryLang) ? 34 : 17}
              onFinish={() => setTyped(true)}
            />
          </div>

          <footer className="card-footer rise" style={{ animationDelay: "640ms" }}>
            <span className="card-outlet">{content.outletName}</span>
            <a href={content.url} target="_blank" rel="noopener noreferrer" className="card-link">
              {t.read} →
            </a>
          </footer>

          {/* Inside the paper (so it isn't a tap that closes the letter), and only after
              the summary has finished typing: by then the letter has been read. */}
          {onAbout && (
            <a
              href="/about"
              className="card-about"
              data-shown={typed || undefined}
              tabIndex={typed ? undefined : -1}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return; // a new tab: just open it
                e.preventDefault();
                onAbout();
              }}
            >
              {t.howChosen}
            </a>
          )}
        </div>
      </article>

      {/* Outside the paper, quiet, and not a link: it only says the note may be wrong.
          (A link here would catch taps meant to close the letter.) */}
      <p className="card-ai-note" data-shown={typed || undefined}>
        {t.aiNote}
      </p>
    </div>
  );
}
