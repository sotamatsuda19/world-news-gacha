"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { playSample } from "@/lib/sound";

const PULL_DISTANCE = 140; // px of upward drag for a fully opened flap
const OPEN_THRESHOLD = 0.4; // let go past this and the envelope opens itself
const TAP_SLOP = 6; // movement below this counts as a tap
const FLIGHT_MS = 1000; // the flight out of the landing point (.envelope-stage in globals.css)
// Taps and keys elsewhere on the screen open the envelope too, but not in the first
// moments: the finger that just long-pressed the globe may still be lifting off.
const ARM_MS = 300;

// A closed airmail envelope that flies out of the landing point along an arc
// (sideways and up/down move with different timing, see .envelope-flight in
// globals.css). Only the stamp is visible; the place stays a secret until the
// letter is opened. Tap anywhere (or press Space / Enter) to open, or drag the
// envelope upward: the flap and the letter follow the finger.
export default function Envelope({
  hint,
  origin,
  onOpened,
}: {
  hint: string;
  origin: { x: number; y: number } | null;
  onOpened: () => void;
}) {
  const [pull, setPull] = useState(0); // 0 = sealed, 1 = flap fully open
  const [dragging, setDragging] = useState(false);
  const [opening, setOpening] = useState(false);
  const drag = useRef<{ startY: number; moved: number } | null>(null);
  // A ref, not the `opening` state: a tap can reach open() twice in one event
  // (the envelope's own handler, then the background's), before React re-renders.
  const opened = useRef(false);
  const shownAt = useRef(0);

  const open = () => {
    if (opened.current) return;
    opened.current = true;
    setOpening(true);
    setDragging(false);
    setPull(1);
    playSample("tear");
    playSample("slide", 0.22); // the letter starts sliding out 220 ms later (globals.css)
    setTimeout(onOpened, 950);
  };

  // A tap or key anywhere else: ignored at first, and held until the envelope has
  // landed if it is still in the air (opening mid-flight looks like a glitch).
  const openFromAnywhere = () => {
    const age = performance.now() - shownAt.current;
    if (age < ARM_MS || opened.current) return;
    if (age < FLIGHT_MS) setTimeout(open, FLIGHT_MS - age);
    else open();
  };
  const openFromAnywhereRef = useRef(openFromAnywhere);
  useEffect(() => {
    openFromAnywhereRef.current = openFromAnywhere;
  });

  useEffect(() => {
    shownAt.current = performance.now();
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault(); // Space would otherwise also "click" a focused button
      openFromAnywhereRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (opening) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, moved: 0 };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || opening) return;
    const dy = drag.current.startY - e.clientY;
    drag.current.moved = Math.max(drag.current.moved, Math.abs(dy));
    setPull(Math.min(1, Math.max(0, dy / PULL_DISTANCE)));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || opening) return;
    if (d.moved < TAP_SLOP || pull > OPEN_THRESHOLD) open();
    else {
      setDragging(false);
      setPull(0); // spring back
    }
  };

  // Start the flight from the landing point (offset from the screen centre).
  const from = origin
    ? { x: origin.x - window.innerWidth / 2, y: origin.y - window.innerHeight / 2 }
    : { x: 0, y: 0 };

  return (
    // The catch area covers the whole screen and stays still while the stage flies.
    <div className="envelope-catch" onClick={openFromAnywhere}>
      <div
        className="envelope-stage"
        data-opening={opening || undefined}
        style={{ "--from-x": `${from.x}px`, "--from-y": `${from.y}px` } as CSSProperties}
      >
        <div className="envelope-flight">
          <button
            type="button"
            className="envelope"
            data-dragging={dragging || undefined}
            data-flipped={pull > 0.5 || undefined}
            style={{ "--pull": pull } as CSSProperties}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            // The envelope handles its own taps and drags (onPointerUp). Without this, a
            // drag that springs back would still reach the catch area as a click and open it.
            onClick={(e) => e.stopPropagation()}
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
      </div>
    </div>
  );
}
