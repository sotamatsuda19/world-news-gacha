import { createEarthGL, EARTH_TEXTURE } from "../earth-gl";
import type { AboutLight } from "./data";

// The moving part of the about page: one canvas that draws the Earth, its town lights,
// the spotlight, the draw (lottery hop → today's headlines → an envelope flying to you)
// and the stream of letters at the end, all driven by how far the page is scrolled.
// The words are ordinary DOM (components/about/AboutStory.tsx); this file only fades
// them in and out at the right scroll positions.
//
// Browser only. startStory() returns a handle; call stop() when the page goes away.
//
// Camera model: an orthographic view of the globe. `A` is the camera's altitude
// (bigger = farther: 3.25 is a dot among the stars, 2 is the whole Earth, ZMIN is as
// close as it gets). The view always has north up; its latitude (the tilt) follows the
// town it flies to, so a far-south town is reached by swinging round, not by sliding
// the whole Earth up the screen.
//
// The Earth is drawn by WebGL2 at the screen's own resolution (smooth when close,
// lib/earth-gl.ts); without WebGL2 it falls back to a plain shaded disc.

const D = Math.PI / 180;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Progress of p inside [a, b], as 0..1.
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;

const SPACE = "#02030a"; // the app's background, so moving between the pages is seamless
const TILT = 22; // the camera's usual latitude
const LEAVE_MS = 900;

// When each line of narration is on screen, as [from, to] in story progress (0..1).
// Same order as AboutText.lines.
export const LINE_RANGES: [number, number][] = [
  [0.05, 0.11],
  [0.115, 0.17],
  [0.175, 0.245],
  [0.25, 0.33],
  [0.335, 0.4],
  [0.405, 0.462],
  [0.467, 0.585],
  [0.705, 0.775],
  [0.785, 0.885],
];

// Scrolling is not spread evenly over the story: the scene with the draw's
// ingredients gets more room (read → the unused ones drift away → the last line),
// and the stretch after the letter arrives gets less. Knots in story progress, and
// how much scroll each stretch between them takes, relative to the rest.
const KNOTS = [0, 0.52, 0.585, 0.615, 0.63, 0.648, 0.675, 0.69, 1];
const WEIGHTS = [1, 0.4, 1, 1.5, 3, 2, 4.5, 1];
const KU = [0];
for (let i = 0; i < WEIGHTS.length; i++) KU.push(KU[i] + (KNOTS[i + 1] - KNOTS[i]) * WEIGHTS[i]);
const warp = (u: number) => {
  const x = u * KU[KU.length - 1];
  let i = 0;
  while (i < WEIGHTS.length - 1 && x > KU[i + 1]) i++;
  return KNOTS[i] + (x - KU[i]) / WEIGHTS[i];
};
// The other way (story progress → scroll position, 0..1). For jumping to a scene.
export const unwarp = (p: number) => {
  let i = 0;
  while (i < WEIGHTS.length - 1 && p > KNOTS[i + 1]) i++;
  return (KU[i] + (p - KNOTS[i]) * WEIGHTS[i]) / KU[KU.length - 1];
};

export type StoryElements = {
  story: HTMLElement; // the tall scrolling section
  stage: HTMLElement; // the screen-sized part that sticks while it scrolls
  canvas: HTMLCanvasElement;
  hero: HTMLElement;
  lines: HTMLElement[]; // in LINE_RANGES order
  flash: HTMLElement;
  flashWhere: HTMLElement;
  flashTitle: HTMLElement;
  letter: HTMLElement;
  cue: HTMLElement;
  cueAfterLetter: HTMLElement;
  recipe: HTMLElement;
  notUsed: HTMLElement[];
  after: HTMLElement;
  end: HTMLElement;
  counts: HTMLElement[]; // each with data-to
};

export type StoryOptions = {
  el: StoryElements;
  lights: AboutLight[];
  label: (light: AboutLight) => string; // "Country · Town"
  today: string; // under the town's name while its headlines show
  startLng: number | null; // the longitude the app's globe was facing, when coming from it
  onLetterNear: () => void; // the current letter is about to arrive (start its summary)
};

export type Story = {
  // Where the draw lands (from /api/draw). Before the draw scene, or any time.
  setDestination: (light: AboutLight) => void;
  // "Another one": fly from the last town to this one and deliver again, on a timer.
  replay: (light: AboutLight) => void;
  isReplaying: () => boolean;
  // Plays the way out (a short zoom, then dark). Resolves with the longitude facing us.
  leave: () => Promise<number>;
  stop: () => void;
};

type Draw = {
  x: number; // index into lights
  prev: number | null;
  heads: { lat: number; lng: number }[]; // the dots of "today's headlines" around the town
  chosen: number; // which dot becomes the letter
  hops: number[]; // random picks for the lottery's hopping light
  announced: boolean; // onLetterNear already called
};

export function startStory(opts: StoryOptions): Story {
  const { el, label, today } = opts;
  const lights = opts.lights.slice();
  const g = el.canvas.getContext("2d")!;
  let stopped = false;

  // ---------- Projection ----------
  let tiltNow = TILT,
    sT = Math.sin(TILT * D),
    cT = Math.cos(TILT * D);
  const setTilt = (t: number) => {
    tiltNow = t;
    sT = Math.sin(t * D);
    cT = Math.cos(t * D);
  };
  // (lat, lng) seen with longitude `lon` facing us → x, y on the unit disc (y down), z > 0 on the near side.
  function proj(lat: number, lng: number, lon: number): [number, number, number] {
    const p = lat * D,
      l = (lng - lon) * D,
      cp = Math.cos(p),
      sp = Math.sin(p),
      cl = Math.cos(l);
    return [cp * Math.sin(l), -(cT * sp - sT * cp * cl), sT * sp + cT * cp * cl];
  }
  type LatLng = { lat: number; lng: number };
  const vec = (c: LatLng) => [Math.cos(c.lat * D) * Math.cos(c.lng * D), Math.cos(c.lat * D) * Math.sin(c.lng * D), Math.sin(c.lat * D)];
  // Along the great circle from a to b.
  function slerp(a: LatLng, b: LatLng, t: number): LatLng {
    const va = vec(a),
      vb = vec(b),
      om = Math.acos(clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1));
    if (om < 1e-6) return { lat: a.lat, lng: a.lng };
    const s = Math.sin(om),
      ka = Math.sin((1 - t) * om) / s,
      kb = Math.sin(t * om) / s;
    const v = [va[0] * ka + vb[0] * kb, va[1] * ka + vb[1] * kb, va[2] * ka + vb[2] * kb];
    return { lat: Math.asin(clamp(v[2], -1, 1)) / D, lng: Math.atan2(v[1], v[0]) / D };
  }

  // ---------- The Earth (WebGL2, lib/earth-gl.ts) ----------
  const earth = createEarthGL();
  const drawEarth = (cx: number, cy: number, r: number, lon: number, sun: LatLng) => earth.draw(cx, cy, r, lon, tiltNow, sun);

  // Night-side town lights: random points on land, found from the texture's colours.
  const night: { lat: number; lng: number; a: number }[] = [];
  const img = new Image();
  img.onload = () => {
    if (stopped) return;
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const cg = c.getContext("2d", { willReadFrequently: true })!;
    cg.drawImage(img, 0, 0);
    const data = cg.getImageData(0, 0, c.width, c.height).data;
    const isLand = (lat: number, lng: number) => {
      const x = Math.floor(((lng + 180) / 360) * c.width) % c.width;
      const y = Math.min(c.height - 1, Math.floor(((90 - lat) / 180) * c.height));
      const i = (y * c.width + x) * 4;
      return data[i] + data[i + 1] > data[i + 2] * 1.35 || data[i] > 150; // the ocean is dark blue
    };
    for (let i = 0; i < 9000 && night.length < 2600; i++) {
      const lat = Math.asin(lerp(-0.85, 0.94, Math.random())) / D,
        lng = Math.random() * 360 - 180;
      if (lat > -56 && isLand(lat, lng)) night.push({ lat, lng, a: 0.15 + Math.random() * 0.5 });
    }
    earth.setTexture(img);
  };
  img.src = EARTH_TEXTURE;

  // ---------- Size ----------
  let W = 0,
    H = 0,
    DPR = 1,
    R2 = 0, // the whole Earth's radius on screen (altitude 2)
    ZMIN = 1.75; // closest altitude: about twice the whole-Earth size
  function resize() {
    DPR = Math.min(devicePixelRatio, 2);
    W = el.stage.clientWidth;
    H = el.stage.clientHeight;
    el.canvas.width = Math.floor(W * DPR);
    el.canvas.height = Math.floor(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    earth.resize(el.canvas.width, el.canvas.height);
    R2 = Math.min(W, H) * (W < 640 ? 0.4 : 0.31);
    ZMIN = W < 640 ? 1.75 : 1.62; // a wide screen starts with a smaller Earth, so goes a little closer
  }
  // The stage may be 0×0 at first (a hidden tab): resize again when it gets a size.
  const ro = new ResizeObserver(() => {
    if (el.stage.clientWidth !== W || el.stage.clientHeight !== H) resize();
  });
  ro.observe(el.stage);
  resize();

  const stars = Array.from({ length: 420 }, () => ({ x: Math.random(), y: Math.random(), r: 0.3 + Math.random() * 1.1, t: Math.random() * 6 }));

  // ---------- The draw ----------
  const received = new Set<number>(); // towns whose letter arrived on this page (gold)
  const indexOf = (light: AboutLight) => {
    let i = lights.findIndex((l) => l.countryCode === light.countryCode);
    if (i < 0) i = lights.push(light) - 1; // a country new since this page was built
    else lights[i] = light; // fly to the drawn article's own town
    return i;
  };
  function newDraw(x: number, prev: number | null): Draw {
    const c = lights[x]?.place ?? { lat: 0, lng: 0 },
      k = 1 / Math.max(0.2, Math.cos(c.lat * D));
    const heads = Array.from({ length: 22 }, () => ({ lat: c.lat + gauss() * 7.5, lng: c.lng + gauss() * 7.5 * k }));
    heads[0] = { lat: c.lat, lng: c.lng };
    const hops = Array.from({ length: 11 }, () => Math.random());
    return { x, prev, heads, chosen: 1 + Math.floor(Math.random() * 21), hops, announced: false };
  }
  let dr = newDraw(lights.length ? Math.floor(Math.random() * lights.length) : 0, null);
  const replay = { on: false, t0: 0, ms: 5200 };

  const t0 = performance.now();
  const lng0 = opts.startLng ?? -40;
  const orbit = (p: number, now: number): LatLng => ({ lat: 16, lng: lng0 + p * 560 + (now - t0) * 0.0015 });
  const scrollQ = (p: number) => seg(p, 0.335, 0.53); // progress through the draw, 0..1

  let leaving: { t0: number } | null = null;

  function camera(p: number, now: number) {
    const fo = orbit(p, now);
    let q = scrollQ(p),
      from: LatLng = orbit(0.335, now);
    if (replay.on) {
      q = clamp((now - replay.t0) / replay.ms);
      if (dr.prev !== null && lights[dr.prev]) from = lights[dr.prev].place;
      if (q >= 1) replay.on = false;
    }
    const X = lights[dr.x]?.place ?? fo;
    let f: LatLng, A: number;
    if (p < 0.04) {
      f = fo;
      A = 3.25;
    } else if (p < 0.335 && !replay.on) {
      f = fo;
      A = lerp(3.25, 2, easeInOut(seg(p, 0.04, 0.16)));
    } else if (p < 0.585 || replay.on) {
      const turn = easeInOut(seg(q, 0.28, 0.45));
      f = slerp(from, X, turn);
      A = lerp(2, ZMIN, turn) + (replay.on ? Math.sin(Math.PI * seg(q, 0, 0.45)) * 0.35 : 0);
    } else {
      const back = easeInOut(seg(p, 0.585, 0.65));
      f = slerp(X, fo, back);
      A = lerp(ZMIN, 2, back);
      if (p > 0.78) A = lerp(2, 2.75, easeInOut(seg(p, 0.78, 0.92)));
    }
    if (leaving) A = lerp(A, Math.min(A, 1.9), easeInOut(seg(now - leaving.t0, 0, LEAVE_MS)));
    return { f, A, q };
  }

  // An envelope (airmail border, stamp), centred at (x, y), w wide.
  function envelope(x: number, y: number, w: number, rot: number, a: number, glow: number) {
    const h = w * 0.62;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.globalAlpha = a;
    if (glow > 0) {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, w * 1.4);
      gr.addColorStop(0, `rgba(255,214,140,${0.35 * glow})`);
      gr.addColorStop(1, "rgba(255,214,140,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, w * 1.4, 0, 7);
      g.fill();
    }
    g.fillStyle = "#f3ead6";
    g.fillRect(-w / 2, -h / 2, w, h);
    if (w > 24) {
      const s = Math.max(2, w * 0.035);
      g.save();
      g.beginPath();
      g.rect(-w / 2, -h / 2, w, h);
      g.rect(-w / 2 + s, -h / 2 + s, w - 2 * s, h - 2 * s);
      g.clip("evenodd");
      for (let i = -w; i < w * 2; i += s * 4) {
        g.fillStyle = (i / (s * 4)) % 2 < 1 ? "#c8463c" : "#2f5d9c";
        g.beginPath();
        g.moveTo(-w / 2 + i, -h / 2);
        g.lineTo(-w / 2 + i + s * 2, -h / 2);
        g.lineTo(-w / 2 + i + s * 2 - h, h / 2);
        g.lineTo(-w / 2 + i - h, h / 2);
        g.fill();
      }
      g.restore();
      g.fillStyle = "#d9a648";
      g.fillRect(w / 2 - w * 0.2, -h / 2 + h * 0.14, w * 0.12, h * 0.26);
    }
    g.strokeStyle = "rgba(120,90,50,0.45)";
    g.lineWidth = Math.max(0.5, w / 120);
    g.beginPath();
    g.moveTo(-w / 2, -h / 2);
    g.lineTo(0, h * 0.08);
    g.lineTo(w / 2, -h / 2);
    g.stroke();
    g.restore();
  }

  const stream: { i: number; t0: number; ang: number; rot: number }[] = [];
  let lastSpawn = 0;
  let flashI = -1,
    flashAt = 0;

  // ---------- One frame ----------
  function frame(p: number, now: number) {
    const { f, A, q } = camera(p, now);
    const R = R2 * Math.exp((2 - A) * 2.75),
      lon = f.lng;
    const w = easeInOut(seg(A, ZMIN, 2)); // 1 = whole Earth, 0 = closest
    setTilt(earth.supported ? lerp(TILT, f.lat, 1 - w) : TILT);
    const [fx, fy] = proj(f.lat, f.lng, lon);
    const inDraw = (p > 0.335 && p < 0.62) || replay.on;
    const fadeBack = replay.on ? 1 : 1 - seg(p, 0.585, 0.62);
    const up = inDraw ? easeInOut(seg(q, 0.55, 0.8)) * fadeBack : 0; // lift the Earth while the letter is below
    const zin = inDraw ? easeInOut(seg(q, 0.28, 0.45)) * fadeBack : 0;
    const yc = H * (0.5 + 0.08 * zin - 0.2 * up + 0.08 * seg(p, 0.88, 0.95));
    const Cx = W / 2 - fx * R * (1 - w),
      Cy = yc - fy * R * (1 - w);
    const S = (v: [number, number, number]): [number, number] => [Cx + v[0] * R, Cy + v[1] * R];

    g.globalAlpha = 1;
    g.fillStyle = SPACE;
    g.fillRect(0, 0, W, H);
    for (const s of stars) {
      g.fillStyle = `rgba(235,240,255,${0.3 + 0.35 * Math.sin(now / 900 + s.t)})`;
      g.beginPath();
      g.arc(s.x * W, s.y * H, s.r, 0, 7);
      g.fill();
    }

    const atm = g.createRadialGradient(Cx, Cy, R * 0.985, Cx, Cy, R * 1.07);
    atm.addColorStop(0, "rgba(90,150,255,0.5)");
    atm.addColorStop(0.35, "rgba(70,120,255,0.14)");
    atm.addColorStop(1, "rgba(60,100,255,0)");
    g.fillStyle = atm;
    g.beginPath();
    g.arc(Cx, Cy, R * 1.07, 0, 7);
    g.fill();
    const sun = { lat: 8, lng: lon - 72 }; // day in the middle, night towards the left (town lights)
    if (drawEarth(Cx * DPR, Cy * DPR, R * DPR, lon, sun)) g.drawImage(earth.canvas, 0, 0, W, H);
    else {
      // No WebGL2 (or the texture is still loading): a plain shaded disc.
      const disc = g.createRadialGradient(Cx - R * 0.35, Cy - R * 0.35, R * 0.1, Cx, Cy, R);
      disc.addColorStop(0, "#2d5a8f");
      disc.addColorStop(1, "#0b1a33");
      g.fillStyle = disc;
      g.beginPath();
      g.arc(Cx, Cy, R, 0, 7);
      g.fill();
    }
    // When the Earth fills the screen, darken the top so the words stay readable.
    const big = clamp((R / Math.min(W, H) - 0.45) * 2);
    if (big > 0) {
      const sc = g.createLinearGradient(0, 0, 0, H * 0.42);
      sc.addColorStop(0, `rgba(0,0,0,${0.62 * big})`);
      sc.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sc;
      g.fillRect(0, 0, W, H * 0.42);
    }
    const sv = vec(sun);
    g.fillStyle = "rgba(255,200,130,1)";
    for (const n of night) {
      const v = proj(n.lat, n.lng, lon);
      if (v[2] <= 0.02) continue;
      const nv = vec(n);
      if (nv[0] * sv[0] + nv[1] * sv[1] + nv[2] * sv[2] >= -0.05) continue; // daytime there
      const [x, y] = S(v);
      if (x < 0 || y < 0 || x > W || y > H) continue;
      g.globalAlpha = n.a * 0.7;
      g.fillRect(x, y, 1, 1);
    }
    g.globalAlpha = 1;

    // The spotlight (headlines light up only a few places).
    const spot = Math.sin(Math.PI * seg(p, 0.165, 0.255));
    const rad = R * 0.36,
      sx = Cx + Math.cos(now / 1500) * R * 0.4,
      sy = Cy - R * 0.15 + Math.sin(now / 1100) * R * 0.25;

    // The towns' lights.
    const n = lights.length;
    const drawing = (p > 0.335 && p < 0.585) || replay.on;
    const hopI = Math.min(dr.hops.length, Math.floor(easeOut(seg(q, 0, 0.26)) * (dr.hops.length + 1)));
    let hl = -1; // the light the lottery is on
    if (drawing && n) {
      if (hopI >= dr.hops.length - 1 || q >= 0.26) hl = dr.x;
      else {
        // The hopping light only lands on towns we can see (the final one may be out of sight).
        const vis = lights.map((c, i) => (proj(c.place.lat, c.place.lng, lon)[2] > 0.3 && i !== dr.x ? i : -1)).filter((i) => i >= 0);
        hl = vis.length ? vis[Math.floor(dr.hops[hopI] * vis.length)] : dr.x;
      }
    }
    const share = drawing ? seg(q, 0, 0.04) * (1 - seg(q, 0.26, 0.32)) : 0; // the "1/40" labels
    const pos: ([number, number] | null)[] = [];
    for (let ci = 0; ci < n; ci++) {
      const c = lights[ci].place,
        v = proj(c.lat, c.lng, lon);
      pos[ci] = v[2] > 0 ? S(v) : null;
      const pt = pos[ci];
      if (!pt) continue;
      const [x, y] = pt;
      if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
      const gold = received.has(ci) || ci === hl;
      const lit = spot > 0.02 ? lerp(1, Math.hypot(x - sx, (y - sy) / 0.8) < rad ? 1 : 0.22, spot) : 1;
      const r = (W < 640 ? 2.2 : 2.6) * (ci === hl ? 1.6 : 1) * (1 + 0.1 * Math.sin(now / 650)) * clamp(R / 140, 0.35, 1);
      const fade = clamp(v[2] * 4);
      const gr = g.createRadialGradient(x, y, 0, x, y, r * 6);
      gr.addColorStop(0, gold ? `rgba(255,214,140,${0.6 * lit * fade})` : `rgba(255,236,205,${0.42 * lit * fade})`);
      gr.addColorStop(1, "rgba(255,236,205,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r * 6, 0, 7);
      g.fill();
      g.fillStyle = gold ? `rgba(255,214,140,${lit * fade})` : `rgba(255,246,228,${lit * fade})`;
      g.beginPath();
      g.arc(x, y, r, 0, 7);
      g.fill();
      if (ci === hl && q < 0.6) {
        g.strokeStyle = `rgba(255,214,140,${0.85 * fade})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(x, y, r + 9, 0, 7);
        g.stroke();
      }
      if (share > 0 && v[2] > 0.25) {
        g.fillStyle = `rgba(238,242,255,${0.5 * share * fade})`;
        g.font = "500 9.5px 'Avenir Next', sans-serif";
        g.textAlign = "center";
        g.fillText(`1/${n}`, x, y + 17);
      }
    }
    if (spot > 0.01) {
      const beam = g.createLinearGradient(0, 0, 0, sy);
      beam.addColorStop(0, `rgba(255,248,225,${0.02 * spot})`);
      beam.addColorStop(1, `rgba(255,248,225,${0.16 * spot})`);
      g.fillStyle = beam;
      g.beginPath();
      g.moveTo(sx - 18, 0);
      g.lineTo(sx + 18, 0);
      g.lineTo(sx + rad, sy);
      g.lineTo(sx - rad, sy);
      g.fill();
      g.fillStyle = `rgba(255,248,225,${0.16 * spot})`;
      g.beginPath();
      g.ellipse(sx, sy, rad, rad * 0.8, 0, 0, Math.PI);
      g.fill();
      g.globalCompositeOperation = "lighter";
      const sl = g.createRadialGradient(sx, sy, 0, sx, sy, rad);
      sl.addColorStop(0, `rgba(255,236,190,${0.3 * spot})`);
      sl.addColorStop(0.7, `rgba(255,236,190,${0.1 * spot})`);
      sl.addColorStop(1, "rgba(255,236,190,0)");
      g.fillStyle = sl;
      g.beginPath();
      g.ellipse(sx, sy, rad, rad * 0.8, 0, 0, 7);
      g.fill();
      g.globalCompositeOperation = "source-over";
      g.fillStyle = `rgba(0,0,0,${0.66 * spot})`;
      g.beginPath();
      g.arc(Cx, Cy, R, 0, 7);
      g.ellipse(sx, sy, rad, rad * 0.8, 0, 0, 7, true);
      g.fill("evenodd");
    }

    // 02: today's headlines, as small dots around the town; one turns gold.
    let from: [number, number] | null = null;
    if (drawing && n && q > 0.42) {
      const ha = seg(q, 0.44, 0.5) * (1 - seg(q, 0.62, 0.7));
      dr.heads.forEach((h, k) => {
        const v = proj(h.lat, h.lng, lon);
        if (v[2] <= 0) return;
        const [x, y] = S(v);
        const ap = seg(q, 0.44 + k * 0.002, 0.48 + k * 0.002);
        const me = k === dr.chosen,
          on = me ? 1 : 1 - 0.75 * seg(q, 0.54, 0.58);
        if (me) from = [x, y];
        if (ha * ap <= 0) return;
        g.fillStyle = me && q > 0.54 ? `rgba(255,214,140,${ha * ap})` : `rgba(210,225,255,${0.8 * ha * ap * on})`;
        g.beginPath();
        g.arc(x, y, me && q > 0.54 ? 3.6 : 2.3, 0, 7);
        g.fill();
        if (!me || q <= 0.54) {
          g.strokeStyle = `rgba(210,225,255,${0.35 * ha * ap * on})`;
          g.lineWidth = 1;
          g.beginPath();
          g.arc(x, y, 5, 0, 7);
          g.stroke();
        }
      });
    }
    // The town's name while flying in; "today's headlines" under it once the dots show.
    const there = pos[dr.x];
    if (drawing && there) {
      const la = seg(q, 0.33, 0.4) * (1 - seg(q, 0.6, 0.66));
      if (la > 0) {
        const [x, y] = there,
          ty = y - Math.max(R * 9 * D, 34) - 14,
          tx = clamp(x, 100, W - 100);
        g.textAlign = "center";
        g.shadowColor = "#000";
        g.shadowBlur = 10;
        g.fillStyle = `rgba(255,214,140,${la})`;
        g.font = "500 12.5px 'Hiragino Sans', sans-serif";
        g.fillText(label(lights[dr.x]), tx, ty);
        const ha2 = seg(q, 0.44, 0.5) * la;
        if (ha2 > 0) {
          g.fillStyle = `rgba(238,242,255,${0.8 * ha2})`;
          g.font = "300 11px 'Hiragino Sans', sans-serif";
          g.fillText(today, tx, ty + 17);
        }
        g.shadowBlur = 0;
      }
    }
    // 03: the envelope flies from the town to the reader.
    if (drawing && q > 0.55 && !dr.announced) {
      dr.announced = true;
      opts.onLetterNear();
    }
    if (drawing && q > 0.58 && q < 0.95 && from) {
      const [fx0, fy0] = from as [number, number];
      const t = easeInOut(seg(q, 0.6, 0.9));
      const tx = W / 2,
        ty = H - Math.max(58, H * 0.09) - 110;
      const cx = lerp(fx0, tx, 0.5) + (fx0 < tx ? -1 : 1) * W * 0.08,
        cy = Math.min(fy0, ty) - H * 0.25;
      const at = (u: number) => [
        (1 - u) * (1 - u) * fx0 + 2 * (1 - u) * u * cx + u * u * tx,
        (1 - u) * (1 - u) * fy0 + 2 * (1 - u) * u * cy + u * u * ty,
      ];
      g.strokeStyle = `rgba(255,214,140,${0.35 * (1 - seg(q, 0.85, 0.93))})`;
      g.lineWidth = 1.2;
      g.beginPath();
      for (let k = 0; k <= 24; k++) {
        const u0 = Math.max(0, t - 0.25),
          [X, Y] = at(u0 + (t - u0) * (k / 24));
        if (k) g.lineTo(X, Y);
        else g.moveTo(X, Y);
      }
      g.stroke();
      const [x, y] = at(t);
      envelope(x, y, lerp(5, Math.min(170, W * 0.4), Math.pow(t, 1.6)), lerp(-0.5, 0.04, t), 1 - seg(q, 0.88, 0.95), 1 - t * 0.6);
    }
    if (drawing && q > 0.9) received.add(dr.x);

    // Dim the Earth behind "this is all the draw uses".
    const dim = seg(p, 0.6, 0.63) * (1 - seg(p, 0.695, 0.715));
    if (dim > 0) {
      g.fillStyle = `rgba(0,0,0,${0.72 * dim})`;
      g.fillRect(0, 0, W, H);
    }

    // Near the end: letters from many towns, flying out towards the reader.
    if (p > 0.78 && p < 0.96 && now - lastSpawn > 140) {
      lastSpawn = now;
      const vis = pos.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      if (vis.length) stream.push({ i: vis[Math.floor(Math.random() * vis.length)], t0: now, ang: Math.random() * 6.3, rot: (Math.random() - 0.5) * 1.2 });
    }
    for (let k = stream.length - 1; k >= 0; k--) {
      const s = stream[k],
        t = (now - s.t0) / 1900,
        start = pos[s.i];
      if (t >= 1 || !start) {
        stream.splice(k, 1);
        continue;
      }
      const dist = Math.max(W, H) * 0.75,
        e = t * t;
      envelope(
        start[0] + Math.cos(s.ang) * dist * e,
        start[1] + Math.sin(s.ang) * dist * e,
        lerp(3, 90, Math.pow(t, 2.2)),
        s.rot * t,
        Math.min(1, t * 5) * (1 - seg(t, 0.75, 1)) * seg(p, 0.78, 0.8) * (1 - seg(p, 0.93, 0.96)),
        0.4,
      );
    }

    // "Every town has a today": real headlines flash up next to their lights.
    const fa = seg(p, 0.26, 0.275) * (1 - seg(p, 0.32, 0.33));
    if (fa > 0 && n) {
      if (now - flashAt > 1500 || flashI < 0 || !pos[flashI]) {
        const cand = pos
          .map((v, i) => (v && v[0] > W * 0.12 && v[0] < W * 0.62 && v[1] > H * 0.3 && v[1] < H * 0.8 && i !== flashI ? i : -1))
          .filter((i) => i >= 0);
        if (cand.length) {
          flashI = cand[Math.floor(Math.random() * cand.length)];
          flashAt = now;
          const c = lights[flashI];
          el.flashWhere.textContent = `${label(c)} · ${c.outletName}`;
          el.flashTitle.textContent = c.title;
          el.flashTitle.lang = c.lang;
        }
      }
      const at = pos[flashI];
      if (at) el.flash.style.transform = `translate(${at[0] + 10}px, ${at[1] - 8}px)`;
      el.flash.style.opacity = String(now - flashAt < 1250 ? fa : 0);
    } else el.flash.style.opacity = "0";

    if (leaving) {
      g.fillStyle = `rgba(2,3,10,${easeInOut(seg(now - leaving.t0, LEAVE_MS * 0.35, LEAVE_MS))})`;
      g.fillRect(0, 0, W, H);
    }
    return { q, lon };
  }

  // ---------- Words, by scroll ----------
  const notOffsets = el.notUsed.map(() => [(Math.random() - 0.5) * 260, -60 - Math.random() * 160]);
  const counted = new Set<HTMLElement>();
  function countUp(b: HTMLElement) {
    if (counted.has(b)) return;
    counted.add(b);
    const to = Number(b.dataset.to) || 0,
      start = performance.now();
    const tick = (now: number) => {
      const k = clamp((now - start) / 1800);
      b.textContent = Math.round(to * easeExpo(k)).toLocaleString("en-US");
      if (k < 1 && !stopped) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  let smooth: number | null = null;
  let lastLon = lng0;
  function tick(now: number) {
    const r = el.story.getBoundingClientRect(),
      span = r.height - innerHeight;
    const target = warp(span > 0 ? clamp(-r.top / span) : 0);
    // A little inertia, so the camera glides after the finger stops.
    // (window.__SNAP: no inertia, for checking scenes in a test browser.)
    smooth = smooth === null || (window as { __SNAP?: boolean }).__SNAP ? target : smooth + (target - smooth) * 0.085;
    const p = smooth;
    const { q, lon } = frame(p, now);
    lastLon = lon;

    el.hero.style.opacity = String(1 - seg(p, 0.03, 0.05));
    el.lines.forEach((line, i) => {
      const [a, b] = LINE_RANGES[i] ?? [2, 2],
        o = seg(p, a, a + 0.01) * (1 - seg(p, b - 0.01, b));
      line.style.opacity = String(o);
      line.style.translate = `0 ${(1 - o) * 10}px`;
    });
    const showLetter = replay.on ? q > 0.92 : p > 0.5 && p < 0.585 && q > 0.92;
    el.letter.toggleAttribute("data-on", showLetter);
    el.cueAfterLetter.toggleAttribute("data-on", showLetter && !replay.on);

    el.recipe.style.opacity = String(seg(p, 0.615, 0.63) * (1 - seg(p, 0.69, 0.7)));
    el.notUsed.forEach((item, k) => {
      const gone = p > 0.648 + k * 0.006;
      item.toggleAttribute("data-gone", gone);
      item.style.transform = gone ? `translate(${notOffsets[k][0]}px, ${notOffsets[k][1]}px) scale(0.6)` : "none";
    });
    el.after.toggleAttribute("data-on", p > 0.675);
    el.cue.style.opacity = String(1 - seg(p, 0.01, 0.03));

    // (While leaving, the words go dark with the Earth.)
    const eo = seg(p, 0.93, 0.96) * (leaving ? 1 - easeInOut(seg(now - leaving.t0, 0, LEAVE_MS * 0.6)) : 1);
    el.end.style.opacity = String(eo);
    el.end.style.pointerEvents = eo > 0.5 ? "auto" : "none";
    if (eo > 0.3) el.counts.forEach(countUp);
  }

  // ---------- Running only while it can be seen ----------
  // Not in a background tab, and not once the story has scrolled away (the footer).
  let raf = 0,
    running = false,
    inView = true;
  const loop = (now: number) => {
    if (!running) return;
    tick(now);
    raf = requestAnimationFrame(loop);
  };
  const update = () => {
    const want = !stopped && inView && document.visibilityState === "visible";
    if (want && !running) {
      running = true;
      raf = requestAnimationFrame(loop);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };
  const io = new IntersectionObserver((entries) => {
    inView = entries.some((e) => e.isIntersecting);
    update();
  });
  io.observe(el.story);
  document.addEventListener("visibilitychange", update);
  update();

  return {
    setDestination(light) {
      dr = newDraw(indexOf(light), null);
    },
    replay(light) {
      if (replay.on) return;
      const prev = dr.x;
      dr = newDraw(indexOf(light), prev);
      replay.on = true;
      replay.t0 = performance.now();
    },
    isReplaying: () => replay.on,
    leave() {
      leaving = { t0: performance.now() };
      return new Promise((resolve) => setTimeout(() => resolve(lastLon), LEAVE_MS));
    },
    stop() {
      stopped = true;
      update();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", update);
      img.onload = null;
      earth.dispose();
    },
  };
}
