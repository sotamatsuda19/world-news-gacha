"use client";

import type { Letter } from "@/lib/letters";
import { countryName, type UiLang, type UiStrings } from "@/lib/i18n";

// Several letters came from the same place: tapping its light lists their headlines.
export default function LetterList({
  letters,
  uiLang,
  t,
  onOpen,
  onClose,
}: {
  letters: Letter[];
  uiLang: UiLang;
  t: UiStrings;
  onOpen: (letter: Letter) => void;
  onClose: () => void;
}) {
  const first = letters[0];
  const city = first.place.names?.[first.summaryLang] ?? first.place.names?.en ?? first.place.city;
  const date = new Intl.DateTimeFormat(uiLang, { month: "short", day: "numeric" });

  return (
    <div className="card-stage" onClick={onClose}>
      <section className="letter-list" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="card-close card-close-quiet" onClick={onClose} aria-label={t.close}>
          ×
        </button>
        <header className="letter-list-head">
          <span className={`fi fi-${first.countryCode} card-flag`} aria-hidden />
          <span>
            {countryName(first.countryCode, first.summaryLang)} · {city}
          </span>
          <span className="letter-list-count">
            {letters.length} {t.letters}
          </span>
        </header>
        <ul>
          {letters.map((letter) => (
            <li key={letter.id}>
              <button type="button" className="letter-list-item" onClick={() => onOpen(letter)}>
                <span className="letter-list-title" lang={letter.lang} dir="auto">
                  {letter.title}
                </span>
                <span className="letter-list-meta">
                  {letter.outletName} · {date.format(letter.receivedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
