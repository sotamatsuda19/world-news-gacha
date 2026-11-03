"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { GlobeInstance } from "globe.gl";
import * as THREE from "three";

export type GlobeHandle = {
  // Spin a few turns and settle on (lat, lng). Resolves when the globe has stopped.
  spinTo: (lat: number, lng: number, durationMs: number) => Promise<void>;
  // Jump to the end of the current spin.
  skip: () => void;
  showMarker: (lat: number, lng: number) => void;
  clearMarker: () => void;
  // Back to the slow idle rotation.
  idle: () => void;
};

// Camera distance (in globe radii). The camera's field of view is vertical, so on a
// tall phone screen the globe would overflow sideways; pull back in portrait.
function altitudes() {
  const portrait = window.innerWidth / window.innerHeight < 0.8;
  return portrait ? { idle: 3.9, landed: 2.9 } : { idle: 2.4, landed: 1.7 };
}
const EXTRA_TURNS = 2; // full revolutions before settling
const SKIP_MS = 450;

function isLightDevice() {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
}

// Ease-out quint: fast start, long gentle stop, like a wheel losing momentum.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 5);

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

const GlobeView = forwardRef<GlobeHandle>(function GlobeView(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const spinRef = useRef<{ raf: number; finish: () => void } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let disposed = false;
    let globe: GlobeInstance | null = null;
    const light = isLightDevice();

    // globe.gl touches `window` at import time, so load it only in the browser.
    import("globe.gl").then(({ default: Globe }) => {
      if (disposed) return;
      globe = new Globe(el, { rendererConfig: { antialias: !light, alpha: false } })
        .backgroundColor("#02030a")
        .globeImageUrl(light ? "/textures/earth-2k.jpg" : "/textures/earth-4k.jpg")
        .bumpImageUrl("/textures/earth-topology.png")
        .showAtmosphere(true)
        .atmosphereColor("#7fb4ff")
        .atmosphereAltitude(0.18)
        .ringColor(() => (t: number) => `rgba(255, 214, 140, ${1 - t})`)
        .ringMaxRadius(4)
        .ringPropagationSpeed(2.2)
        .ringRepeatPeriod(900)
        .width(el.clientWidth)
        .height(el.clientHeight);

      globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, light ? 1.5 : 2));
      globe.scene().add(makeStars(light ? 900 : 1800));
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
      if (spinRef.current) cancelAnimationFrame(spinRef.current.raf);
      globe?._destructor();
      el.innerHTML = "";
    };
  }, []);

  useImperativeHandle(ref, () => ({
    spinTo(lat, lng, durationMs) {
      const globe = globeRef.current;
      if (!globe) return Promise.resolve();
      const controls = globe.controls();
      controls.autoRotate = false;
      controls.enabled = false;

      const from = globe.pointOfView();
      const landed = altitudes().landed;
      // Always spin eastward-looking (lng increasing) and add whole turns for drama.
      const delta = ((((lng - from.lng) % 360) + 360) % 360) + 360 * EXTRA_TURNS;
      // Progress is accumulated per frame so that skip() can fast-forward along
      // the same path instead of jumping.
      let elapsed = 0;
      let rate = 1;
      let last = performance.now();

      return new Promise<void>((resolve) => {
        const frame = (now: number) => {
          elapsed += (now - last) * rate;
          last = now;
          const t = Math.min(1, elapsed / durationMs);
          const k = easeOut(t);
          globe.pointOfView(
            {
              lat: from.lat + (lat - from.lat) * k,
              lng: from.lng + delta * k,
              altitude: from.altitude + (landed - from.altitude) * k,
            },
            0,
          );
          if (t < 1) {
            spinRef.current!.raf = requestAnimationFrame(frame);
          } else {
            spinRef.current = null;
            resolve();
          }
        };
        spinRef.current = {
          raf: requestAnimationFrame(frame),
          // Finish whatever is left of the spin in SKIP_MS.
          finish: () => {
            rate = Math.max(rate, (durationMs - elapsed) / SKIP_MS);
          },
        };
      });
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

  return <div ref={containerRef} className="absolute inset-0" aria-hidden />;
});

export default GlobeView;
