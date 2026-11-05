"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import type { GlobeInstance } from "globe.gl";
import * as THREE from "three";
import { distanceKm } from "@/lib/draw";

export type SpinOptions = {
  durationMs: number;
  // Whole revolutions added for drama (2 for the button). 0 = the shortest way there.
  turns: number;
  // A short wind-up before the spin: the globe sinks back a little, then goes.
  anticipate: boolean;
  // Called every frame with the spin's speed, 0 (still) to 1 (fastest). Drives the wind sound.
  onSpeed?: (speed: number) => void;
};

// Something on the globe: a light where letters came from, or a pinned place
// (drawn as a sewing pin stuck into the globe).
export type GlobeLight = { key: string; lat: number; lng: number; count: number; kind: "letter" | "pin" };

export type GlobeHandle = {
  // Spin and settle on (lat, lng). Resolves when the globe has stopped.
  spinTo: (lat: number, lng: number, options: SpinOptions) => Promise<void>;
  // Jump to the end of the current spin.
  skip: () => void;
  // After landing: move in closer for the "it's here!" moment. Resolves when done.
  zoomIn: (durationMs: number) => Promise<void>;
  // Where (lat, lng) currently is on screen, in CSS pixels.
  screenPoint: (lat: number, lng: number) => { x: number; y: number } | null;
  showMarker: (lat: number, lng: number) => void;
  clearMarker: () => void;
  setLights: (lights: GlobeLight[]) => void;
  // Back to the slow idle rotation.
  idle: () => void;
};

type Props = {
  onReady?: () => void;
  // Press and hold (without moving) on the globe. Only while `pressable`.
  onLongPress?: (point: { lat: number; lng: number }) => void;
  pressable?: boolean;
  onLightClick?: (light: GlobeLight) => void;
  // Pins answer taps only while placing them (a tap removes one). Otherwise taps
  // go to the letter lights, even where a pin stands on top of one.
  pinsTappable?: boolean;
};

// Camera distance (in globe radii). The camera's field of view is vertical, so on a
// tall phone screen the globe would overflow sideways; pull back in portrait.
function altitudes() {
  const portrait = window.innerWidth / window.innerHeight < 0.8;
  return portrait ? { idle: 3.9, landed: 2.9, close: 1.5 } : { idle: 2.4, landed: 1.7, close: 0.9 };
}
const SKIP_MS = 450;
const WIND_UP_MS = 240;
const LONG_PRESS_MS = 600;
const PRESS_SLOP = 8; // px: moving more than this is a drag (rotate), not a press
const LIGHT_TAP_RADIUS = 22; // px: a tap this close to a light opens it
const LIGHT_ALTITUDE = 0.012;
const GLOBE_RADIUS = 100; // three-globe's globe radius, in scene units
const PIN_PX = 30; // a pin's length on screen, in CSS pixels, at any zoom
const PIN_DROP_MS = 420;

function isLightDevice() {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
}

// Ease-out quint: fast start, long gentle stop, like a wheel losing momentum.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 5);
// How fast easeOut moves at t (its slope), relative to its fastest (5 at t = 0).
const easeOutSpeed = (t: number) => Math.pow(1 - t, 4);
const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
// Overshoots a little past 1 and settles back: the pin goes in a bit deep, then rests.
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

function makeStars(count: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Random points on a far sphere around the globe.
    const r = 1800 + Math.random() * 600;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.85,
  });
  return new THREE.Points(geometry, material);
}

// A soft round glow, drawn once on a small canvas and reused by every light.
function makeGlowTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.12, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.28, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// A light is a sprite (a picture that always faces the camera) with additive
// blending, so overlapping lights add up like real light. Its size is fixed on
// screen (sizeAttenuation: false), so it looks the same however far the camera is.
// Taps are not detected on the sprite itself (three.js picks small sprites
// unreliably) but by screen distance, in lightAt() below.
function makeLightSprite(light: GlobeLight, texture: THREE.Texture) {
  // Sprite sizes are a fraction of the screen's height; on a tall phone screen the
  // globe is small for that height, so shrink the lights to match.
  const sizeFactor = window.innerWidth / window.innerHeight < 0.8 ? 0.6 : 1;
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffd68c,
    transparent: true,
    opacity: Math.min(1, 0.8 + 0.1 * Math.log2(light.count)),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: false,
  });
  const sprite = new THREE.Sprite(material);
  const scale = sizeFactor * (0.06 + 0.01 * Math.min(4, Math.log2(light.count)));
  sprite.scale.set(scale, scale, 1);

  // The globe hides lights on its far side, but one near the horizon would still
  // spill its glow out into space (the glow is wider than the light). So fade each
  // light out as it nears the horizon, right before it is drawn.
  // A point p is visible from the camera c when the angle between them, seen from
  // the globe's centre, has cos > R / |c| (R = the globe's radius, 100 in three-globe).
  const fullOpacity = material.opacity;
  const position = new THREE.Vector3();
  sprite.onBeforeRender = (_renderer, _scene, camera) => {
    sprite.getWorldPosition(position);
    const cam = camera.position;
    const cos = position.dot(cam) / (position.length() * cam.length());
    const horizon = GLOBE_RADIUS / cam.length();
    material.opacity = fullOpacity * Math.min(1, Math.max(0, (cos - horizon) / 0.2));
  };
  return sprite;
}

// ---------- Pins ----------
//
// A sewing pin: a thin steel needle with a round red head, built from two meshes.
// It is made at a length of 1 and pointing along +Z, which is "up" from the ground
// once three-globe has placed it (objectFacesSurface turns an object's +Z to face
// away from the globe's centre). Nested groups each do one job:
//   root  – scaled every frame so the pin keeps the same size on screen (PIN_PX)
//   drop  – slides along +Z for the "stuck in" animation
//   tilt  – leans the pin a little, a different way for each place
type Pin = { root: THREE.Group; drop: THREE.Group; head: THREE.Mesh; droppedAt: number | null };

let pinParts: { needle: THREE.BufferGeometry; head: THREE.BufferGeometry; steel: THREE.Material; red: THREE.Material } | null =
  null;
function getPinParts() {
  if (!pinParts) {
    // A cylinder stands along Y; turn it to Z. It runs from z = -0.12 (in the ground) to 0.88.
    const needle = new THREE.CylinderGeometry(0.028, 0.008, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.38);
    const head = new THREE.SphereGeometry(0.13, 20, 14).translate(0, 0, 0.92);
    // Phong (shiny highlights) suits the globe's plain lights better than metal
    // materials, which look black without a reflection map. A little emissive keeps
    // the head readable on the night side.
    const steel = new THREE.MeshPhongMaterial({ color: 0xc9cfd6, specular: 0xffffff, shininess: 90 });
    const red = new THREE.MeshPhongMaterial({ color: 0xd8392c, specular: 0x664444, shininess: 60, emissive: 0x3a0a06 });
    pinParts = { needle, head, steel, red };
  }
  return pinParts;
}

function makePin(light: GlobeLight, dropping: boolean): Pin {
  const parts = getPinParts();
  const head = new THREE.Mesh(parts.head, parts.red);
  const tilt = new THREE.Group();
  tilt.add(new THREE.Mesh(parts.needle, parts.steel), head);
  // Lean 10–18° towards a direction taken from the coordinates: always the same for
  // the same place, different between places. (Euler order ZXY: lean about X, then
  // turn that lean around the pin's up axis.)
  const seed = Math.abs(Math.sin(light.lat * 12.9898 + light.lng * 78.233)) * 43758.5453;
  const frac = seed - Math.floor(seed);
  tilt.rotation.set(THREE.MathUtils.degToRad(10 + 8 * frac), 0, frac * Math.PI * 2, "ZXY");
  const drop = new THREE.Group();
  drop.add(tilt);
  const root = new THREE.Group();
  root.add(drop);
  return { root, drop, head, droppedAt: dropping ? performance.now() : null };
}

const GlobeView = forwardRef<GlobeHandle, Props>(function GlobeView(
  { onReady, onLongPress, pressable, onLightClick, pinsTappable },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const spinRef = useRef<{ finish: () => void } | null>(null);
  const rafRef = useRef(0);
  // Read through refs so the globe isn't rebuilt when the parent re-renders.
  const callbacks = useRef({ onReady, onLongPress, onLightClick, pressable, pinsTappable });
  useEffect(() => {
    callbacks.current = { onReady, onLongPress, onLightClick, pressable, pinsTappable };
  }, [onReady, onLongPress, onLightClick, pressable, pinsTappable]);
  // The pins on the globe now, by key, and the keys of pins just added (they drop in).
  const pinsRef = useRef(new Map<string, Pin>());
  const droppingRef = useRef(new Set<string>());
  const lightsShown = useRef(false); // false until the first setLights()

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let disposed = false;
    let globe: GlobeInstance | null = null;
    const light = isLightDevice();

    // globe.gl touches `window` at import time, so load it only in the browser.
    import("globe.gl").then(({ default: Globe }) => {
      if (disposed) return;
      const glow = makeGlowTexture();
      globe = new Globe(el, { rendererConfig: { antialias: !light, alpha: false } })
        .backgroundColor("#02030a")
        .globeImageUrl(light ? "/textures/earth-2k.jpg" : "/textures/earth-4k.jpg")
        .bumpImageUrl("/textures/earth-topology.png")
        .showAtmosphere(true)
        .atmosphereColor("#7fb4ff")
        .atmosphereAltitude(0.18)
        .ringColor(() => (t: number) => `rgba(255, 226, 160, ${Math.pow(1 - t, 1.5)})`)
        .ringMaxRadius(7)
        .ringPropagationSpeed(3.5)
        .ringRepeatPeriod(700)
        .ringAltitude(0.004)
        // Lights: places letters came from, and pinned places.
        .objectLat("lat")
        .objectLng("lng")
        .objectAltitude((d) => ((d as GlobeLight).kind === "pin" ? 0 : LIGHT_ALTITUDE))
        .objectThreeObject((d) => {
          const item = d as GlobeLight;
          if (item.kind !== "pin") return makeLightSprite(item, glow);
          const pin = makePin(item, droppingRef.current.delete(item.key));
          pinsRef.current.set(item.key, pin);
          return pin.root;
        })
        // Fires once the earth texture has loaded: lifts the loading screen.
        .onGlobeReady(() => callbacks.current.onReady?.())
        .width(el.clientWidth)
        .height(el.clientHeight);

      globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, light ? 1.5 : 2));
      globe.scene().add(makeStars(light ? 900 : 1800));

      // Every frame, before drawing: size each pin for its distance from the camera
      // (so it looks the same size at any zoom), and run the drop-in animation.
      // Scene matrices are already computed at this point, so each pin's are redone.
      const pinPos = new THREE.Vector3();
      globe.scene().onBeforeRender = (renderer, _scene, camera) => {
        const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);
        const screenH = renderer.domElement.clientHeight || 1;
        const now = performance.now();
        for (const pin of pinsRef.current.values()) {
          if (!pin.root.parent) continue; // removed from the globe
          pin.root.getWorldPosition(pinPos);
          const worldPerPx = (2 * Math.tan(fov / 2) * pinPos.distanceTo(camera.position)) / screenH;
          pin.root.scale.setScalar(PIN_PX * worldPerPx);
          if (pin.droppedAt !== null) {
            const t = Math.min(1, (now - pin.droppedAt) / PIN_DROP_MS);
            pin.drop.position.z = 1.4 * (1 - easeOutBack(t)); // in pin lengths, from above
            if (t >= 1) pin.droppedAt = null;
          }
          pin.root.updateMatrixWorld(true);
        }
      };
      globe.pointOfView({ lat: 20, lng: 135, altitude: altitudes().idle }, 0);

      const controls = globe.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
      controls.enableZoom = false;
      controls.enablePan = false;
      globeRef.current = globe;
    });

    const onResize = () => {
      if (globe && el) globe.width(el.clientWidth).height(el.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      globe?._destructor();
      el.innerHTML = "";
    };
  }, []);

  // ---------- Long press ----------

  const press = useRef<{ x: number; y: number; id: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [holding, setHolding] = useState<{ x: number; y: number } | null>(null);
  // A long press ends with a click; it must not also count as "tap to skip".
  const swallowClick = useRef(false);

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
    setHolding(null);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    downAt.current = { x: e.clientX, y: e.clientY };
    if (press.current) return cancelPress(); // a second finger: pinch, not a press
    if (!callbacks.current.pressable || e.button !== 0) return;
    const { clientX: x, clientY: y } = e;
    const timer = setTimeout(() => {
      press.current = null;
      setHolding(null);
      const rect = containerRef.current!.getBoundingClientRect();
      const point = globeRef.current?.toGlobeCoords(x - rect.left, y - rect.top);
      if (!point || !callbacks.current.pressable) return; // pressed on space, not the globe
      swallowClick.current = true;
      callbacks.current.onLongPress?.(point);
    }, LONG_PRESS_MS);
    press.current = { x, y, id: e.pointerId, timer };
    setHolding({ x, y });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (p && p.id === e.pointerId && Math.hypot(e.clientX - p.x, e.clientY - p.y) > PRESS_SLOP) cancelPress();
  };

  // ---------- Tapping a light ----------

  const lightsRef = useRef<GlobeLight[]>([]);
  const downAt = useRef<{ x: number; y: number } | null>(null);

  // The light closest to the screen point (x, y), if one is within LIGHT_TAP_RADIUS.
  // Lights on the far side of the globe can project near the point too; requiring
  // the light to be within ~80° of the tapped spot on the globe rules them out.
  // A pin is tapped by its head, which stands off the ground and leans.
  const lightAt = (x: number, y: number): GlobeLight | null => {
    const globe = globeRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!globe || !rect) return null;
    const tapped = globe.toGlobeCoords(x - rect.left, y - rect.top);
    if (!tapped) return null;
    const wantPins = !!callbacks.current.pinsTappable;
    let best: { light: GlobeLight; px: number } | null = null;
    for (const light of lightsRef.current) {
      if ((light.kind === "pin") !== wantPins || distanceKm(tapped, light) > 9000) continue;
      const head = light.kind === "pin" ? pinsRef.current.get(light.key)?.head : undefined;
      const screen = head ? headOnScreen(head, globe.camera(), rect) : globe.getScreenCoords(light.lat, light.lng, LIGHT_ALTITUDE);
      const px = Math.hypot(screen.x - (x - rect.left), screen.y - (y - rect.top));
      if (px <= LIGHT_TAP_RADIUS && (!best || px < best.px)) best = { light, px };
    }
    return best?.light ?? null;
  };

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const d = downAt.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > PRESS_SLOP) return; // the end of a drag
    const light = lightAt(e.clientX, e.clientY);
    if (light) callbacks.current.onLightClick?.(light);
  };

  // ---------- Camera moves ----------

  // Runs `step(progress)` every frame for `durationMs`. `rate` can be raised mid-way
  // (skip): progress is accumulated per frame, so a skip fast-forwards along the
  // same path instead of jumping.
  function animate(durationMs: number, step: (t: number, speed: number) => void, control?: { rate: number }) {
    return new Promise<void>((resolve) => {
      let elapsed = 0;
      let last = performance.now();
      const frame = (now: number) => {
        const rate = control?.rate ?? 1;
        elapsed += (now - last) * rate;
        last = now;
        const t = Math.min(1, elapsed / durationMs);
        step(t, rate);
        if (t < 1) rafRef.current = requestAnimationFrame(frame);
        else resolve();
      };
      rafRef.current = requestAnimationFrame(frame);
    });
  }

  useImperativeHandle(ref, () => ({
    async spinTo(lat, lng, { durationMs, turns, anticipate, onSpeed }) {
      const globe = globeRef.current;
      if (!globe) return;
      const controls = globe.controls();
      controls.autoRotate = false;
      controls.enabled = false;

      const control = { rate: 1 };
      let skipped = false;
      spinRef.current = {
        finish: () => {
          skipped = true;
          control.rate = Math.max(control.rate, durationMs / SKIP_MS);
        },
      };

      // Wind-up: pull back and turn slightly the "wrong" way, like drawing a bow.
      if (anticipate) {
        const start = globe.pointOfView();
        await animate(WIND_UP_MS, (t) => {
          if (skipped) return;
          const k = easeInOut(t);
          globe.pointOfView({ lat: start.lat, lng: start.lng - 5 * k, altitude: start.altitude * (1 + 0.07 * k) }, 0);
          onSpeed?.(0.12 * k);
        });
      }

      const from = globe.pointOfView();
      const landed = altitudes().landed;
      const forward = (((lng - from.lng) % 360) + 360) % 360; // eastward-looking, 0..360
      // With turns: always forward, plus whole turns. Without: the shorter way round.
      const delta = turns > 0 ? forward + 360 * turns : forward > 180 ? forward - 360 : forward;
      const latDelta = lat - from.lat;
      // Speed for the sound: this spin's own top speed counts as 1, but a short,
      // gentle spin also sounds gentler (loudness scales with the top speed).
      const topSpeed = ((Math.abs(delta) + Math.abs(latDelta)) * 5) / durationMs; // degrees per ms at t = 0
      const loudness = Math.min(1, Math.max(0.35, topSpeed / 1.1));

      control.rate = skipped ? durationMs / SKIP_MS : 1;
      await animate(
        durationMs,
        (t, rate) => {
          const k = easeOut(t);
          globe.pointOfView(
            { lat: from.lat + latDelta * k, lng: from.lng + delta * k, altitude: from.altitude + (landed - from.altitude) * k },
            0,
          );
          onSpeed?.(t >= 1 ? 0 : Math.min(1, easeOutSpeed(t) * rate * loudness));
        },
        control,
      );
      spinRef.current = null;
    },
    zoomIn(durationMs) {
      const globe = globeRef.current;
      if (!globe) return Promise.resolve();
      const from = globe.pointOfView();
      const to = altitudes().close;
      return animate(durationMs, (t) => {
        globe.pointOfView({ ...from, altitude: from.altitude + (to - from.altitude) * easeOut(t) }, 0);
      });
    },
    screenPoint(lat, lng) {
      return globeRef.current?.getScreenCoords(lat, lng) ?? null;
    },
    skip() {
      spinRef.current?.finish();
    },
    showMarker(lat, lng) {
      globeRef.current?.ringsData([{ lat, lng }]);
    },
    clearMarker() {
      globeRef.current?.ringsData([]);
    },
    setLights(lights) {
      // Pins that weren't there before drop in (but not the saved ones that appear
      // with the page's first lights).
      const before = new Set(lightsRef.current.map((l) => l.key));
      for (const l of lights) {
        if (l.kind === "pin" && !before.has(l.key) && lightsShown.current) droppingRef.current.add(l.key);
      }
      lightsShown.current = true;
      const keep = new Set(lights.map((l) => l.key));
      for (const key of pinsRef.current.keys()) if (!keep.has(key)) pinsRef.current.delete(key);
      lightsRef.current = lights;
      globeRef.current?.objectsData(lights);
    },
    idle() {
      const globe = globeRef.current;
      if (!globe) return;
      const pov = globe.pointOfView();
      globe.pointOfView({ ...pov, altitude: altitudes().idle }, 1200);
      const controls = globe.controls();
      controls.enabled = true;
      controls.autoRotate = true;
    },
  }));

  return (
    <div
      className="absolute inset-0"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onClick={onClick}
      onClickCapture={(e) => {
        if (swallowClick.current) {
          swallowClick.current = false;
          e.stopPropagation();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={containerRef} className="absolute inset-0" aria-hidden />
      {holding && <span className="press-ring" style={{ left: holding.x, top: holding.y }} aria-hidden />}
    </div>
  );
});

// Where a pin's head is on screen, in pixels from the container's top-left.
const headPos = new THREE.Vector3();
function headOnScreen(head: THREE.Mesh, camera: THREE.Camera, rect: DOMRect) {
  // The ball is not at the mesh's origin (its geometry is moved up the needle), so
  // take its centre from the geometry and carry it into world space.
  if (!head.geometry.boundingSphere) head.geometry.computeBoundingSphere();
  headPos.copy(head.geometry.boundingSphere!.center).applyMatrix4(head.matrixWorld);
  headPos.project(camera); // to -1..1 across the screen
  return { x: ((headPos.x + 1) / 2) * rect.width, y: ((1 - headPos.y) / 2) * rect.height };
}

export default GlobeView;
