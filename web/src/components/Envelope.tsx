"use client";

import { useRef, useState } from "react";

// A closed airmail envelope. Only the stamp is visible; the place stays a secret
// until the letter is opened. Tap or swipe up to cut it open.
export default function Envelope({ hint, onOpened }: { hint: string; onOpened: () => void }) {
  const [opening, setOpening] = useState(false);
  const touchY = useRef<number | null>(null);

  const open = () => {
    if (opening) return;
    setOpening(true);
    setTimeout(onOpened, 950);
  };

  return (
    <div className="envelope-stage" data-opening={opening || undefined}>
      <button
        type="button"
        className="envelope"
        onClick={open}
        onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
        onTouchEnd={(e) => {
          const start = touchY.current;
          touchY.current = null;
          if (start !== null && start - e.changedTouches[0].clientY > 30) open();
        }}
        aria-label={hint}
      >
        <span className="envelope-back" />
        <span className="envelope-letter" />
        <span className="envelope-front" />
        <span className="envelope-flap" />
        <span className="stamp">
          <svg viewBox="0 0 40 48" aria-hidden>
            <circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <ellipse cx="20" cy="20" rx="5" ry="11" fill="none" stroke="currentColor" strokeWidth="1" />
            <line x1="9" y1="20" x2="31" y2="20" stroke="currentColor" strokeWidth="1" />
            <text x="20" y="42" textAnchor="middle" fontSize="6.5" fill="currentColor" letterSpacing="0.6">
              AIR MAIL
            </text>
          </svg>
        </span>
        <span className="postmark" aria-hidden />
      </button>
      <p className="envelope-hint">{hint}</p>
    </div>
  );
}
