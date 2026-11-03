"use client";

import { useState } from "react";
import type { DrawResult } from "@/lib/types";
import { countryName, type UiStrings } from "@/lib/i18n";
import Typewriter from "./Typewriter";

// Languages written in wide characters carry more per character, so type them slower.
const WIDE_SCRIPT = /^(ja|zh|ko)/;

// The letter's contents. Place, headline and photo rise first; the AI summary
// types itself out underneath.
export default function LetterCard({
  article,
  summary,
  summaryDone,
  uiLang,
  t,
  onClose,
}: {
  article: DrawResult;
  summary: string;
  summaryDone: boolean;
  uiLang: string;
  t: UiStrings;
  onClose: () => void;
}) {
  // If the outlet blocks hotlinking or the OGP URL is dead, switch to the
  // free-license city photo picked by the collector.
  const [image, setImage] = useState(article.image ?? article.fallbackImage);
  const city = article.place.names?.[uiLang] ?? article.place.city;

  return (
    <div className="card-stage" onClick={onClose}>
      <article className="letter-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="card-close" onClick={onClose} aria-label={t.close}>
          ×
        </button>

        {image && (
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="card-photo rise" style={{ animationDelay: "0ms" }}>
            {/* Plain <img>: the browser loads it straight from the publisher, never via our server. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt=""
              referrerPolicy="no-referrer"
              loading="eager"
              onError={() => setImage(image.source === "ogp" ? article.fallbackImage : null)}
            />
            {image.source === "fallback" && image.credit && (
              <span className="photo-credit">
                {t.photo}: {image.credit}
              </span>
            )}
          </a>
        )}

        <div className="card-body">
          <p className="card-place rise" style={{ animationDelay: "120ms" }}>
            <span className={`fi fi-${article.countryCode} card-flag`} aria-hidden />
            <span>{countryName(article.countryCode, uiLang)}</span>
            <span className="card-dot">·</span>
            <span>{city}</span>
          </p>

          <h2 className="card-headline rise" lang={article.lang} dir="auto" style={{ animationDelay: "240ms" }}>
            {article.title}
          </h2>

          <div className="card-summary rise" style={{ animationDelay: "520ms" }}>
            <Typewriter text={summary} done={summaryDone} lang={uiLang} msPerChar={WIDE_SCRIPT.test(uiLang) ? 34 : 17} />
          </div>

          <footer className="card-footer rise" style={{ animationDelay: "640ms" }}>
            <span className="card-outlet">{article.outletName}</span>
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="card-link">
              {t.read} →
            </a>
          </footer>
        </div>
      </article>
    </div>
  );
}
