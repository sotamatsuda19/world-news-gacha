"use client";

import { useEffect, useRef } from "react";
import { createEarthGL, EARTH_TEXTURE } from "@/lib/earth-gl";

// A quiet background for the reading pages (terms, publishers): stars, and a large
// Earth turning slowly in the lower right, half out of the screen.
// Nothing from the reader's letters is shown.
//
// Light on purpose: the Earth turns once every few minutes, so ~20 frames a second is
// plenty; nothing is drawn while the tab is hidden; with "reduce motion" it stays still.

const TURN_SECONDS = 160; // one full turn
const FRAME_MS = 50;
const TILT = 22;

export default function EarthBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext("2d")!;
    const earth = createEarthGL();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stars = Array.from({ length: 320 }, () => ({ x: Math.random(), y: Math.random(), r: 0.3 + Math.random() * 1, a: 0.2 + Math.random() * 0.45 }));
    const lng0 = 100 + Math.random() * 120;
    const t0 = performance.now();
    let W = 0,
      H = 0,
      DPR = 1;

    function draw(now: number) {
      if (!W || !H) return;
      g.globalAlpha = 1;
      g.fillStyle = "#02030a";
      g.fillRect(0, 0, W, H);
      for (const s of stars) {
        g.fillStyle = `rgba(235,240,255,${s.a})`;
        g.beginPath();
        g.arc(s.x * W, s.y * H, s.r, 0, 7);
        g.fill();
      }
      // Big, low and to the right; on a phone mostly below the text.
      const narrow = W < 640;
      const R = narrow ? W * 0.95 : Math.min(W, H) * 0.62;
      const Cx = narrow ? W * 0.78 : W * 0.92;
      const Cy = narrow ? H + R * 0.32 : H * 0.98;
      const lon = lng0 - (still ? 0 : ((now - t0) / 1000 / TURN_SECONDS) * 360);
      const atm = g.createRadialGradient(Cx, Cy, R * 0.985, Cx, Cy, R * 1.06);
      atm.addColorStop(0, "rgba(90,150,255,0.4)");
      atm.addColorStop(0.35, "rgba(70,120,255,0.1)");
      atm.addColorStop(1, "rgba(60,100,255,0)");
      g.fillStyle = atm;
      g.beginPath();
      g.arc(Cx, Cy, R * 1.06, 0, 7);
      g.fill();
      if (earth.draw(Cx * DPR, Cy * DPR, R * DPR, lon, TILT, { lat: 10, lng: lon + 35 })) {
        g.globalAlpha = narrow ? 0.5 : 0.7; // on a phone the words run over it, so dimmer
        g.drawImage(earth.canvas, 0, 0, W, H);
        g.globalAlpha = 1;
      }
      // Keep the words readable: darken from the top-left, where the text is.
      const veil = g.createLinearGradient(0, 0, W * 0.9, H);
      veil.addColorStop(0, "rgba(2,3,10,0.55)");
      veil.addColorStop(0.6, "rgba(2,3,10,0.25)");
      veil.addColorStop(1, "rgba(2,3,10,0)");
      g.fillStyle = veil;
      g.fillRect(0, 0, W, H);
    }

    function resize() {
      DPR = Math.min(devicePixelRatio, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      earth.resize(canvas.width, canvas.height);
      draw(performance.now());
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const img = new Image();
    img.onload = () => {
      earth.setTexture(img);
      draw(performance.now());
    };
    img.src = EARTH_TEXTURE;

    let raf = 0,
      last = 0;
    const loop = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now;
        draw(now);
      }
      raf = requestAnimationFrame(loop);
    };
    const update = () => {
      cancelAnimationFrame(raf);
      if (!still && document.visibilityState === "visible") raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", update);
    update();

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", update);
      ro.disconnect();
      img.onload = null;
      earth.dispose();
    };
  }, []);

  return <canvas ref={ref} className="info-backdrop" aria-hidden />;
}
