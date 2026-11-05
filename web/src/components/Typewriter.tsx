"use client";

import { useEffect, useState } from "react";

// Reveals `text` one character at a time at a steady pace, even when the whole
// summary has already arrived. The rhythm is part of the "reading a letter" feel.
export default function Typewriter({
  text,
  done,
  msPerChar = 24,
  lang,
  instant = false,
}: {
  text: string;
  done: boolean;
  msPerChar?: number;
  lang?: string;
  instant?: boolean; // show everything at once (re-reading a saved letter)
}) {
  const [shown, setShown] = useState(0);
  // Split by code point so emoji / CJK stay whole; collapse blank lines the model may add.
  const chars = Array.from(text.replace(/\n\s*\n/g, "\n"));

  useEffect(() => {
    if (instant || shown >= chars.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), msPerChar);
    return () => clearTimeout(id);
  }, [shown, chars.length, msPerChar, instant]);

  const visible = instant ? chars.length : shown;
  const typing = !done || visible < chars.length;

  return (
    <p lang={lang} className="whitespace-pre-line leading-relaxed">
      {chars.slice(0, visible).join("")}
      {typing && <span className="caret" aria-hidden />}
    </p>
  );
}
