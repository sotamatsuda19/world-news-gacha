// All the sounds, through the Web Audio API. Browser only.
//
// Web Audio works like a small mixing desk: "nodes" (a noise source, a filter, a
// volume knob…) are connected into a graph that ends at the speakers. Here:
//
//   wind:     looping noise ─▶ band-pass filter ─▶ gain ─┐
//   landing:  synthesized thump + bell (made per use) ───┼─▶ master gain ─▶ speakers
//   paper:    decoded MP3 files (public/sounds/) ────────┘
//
// The spin and landing are synthesized: the wind has to follow the globe's speed
// frame by frame (and speed up on skip), which a fixed recording can't do.
// The paper sounds are recordings (see public/sounds/CREDITS.md).
//
// Browsers only allow audio after the user does something, so the AudioContext is
// created in `unlockAudio()`, called from the button press / a press on the globe.

export type Sample = "envelope" | "tear" | "slide" | "unfold" | "fold";

// How loud each recording plays. The files are all levelled to the same peak
// (scripts/make-sounds.sh); this is where they are balanced by ear.
const SAMPLE_GAIN: Record<Sample, number> = {
  envelope: 0.5,
  tear: 0.65,
  slide: 0.45,
  unfold: 0.4,
  fold: 0.4,
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
const samples = new Map<Sample, AudioBuffer>();
let noise: AudioBuffer | null = null;

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (ctx && master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02);
}

// Call from inside a user gesture (pointerdown / click).
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = enabled ? 1 : 0;
    master.connect(ctx.destination);
    noise = makeNoise(ctx, 2);
    void loadSamples(ctx);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

async function loadSamples(audio: AudioContext) {
  const names = Object.keys(SAMPLE_GAIN) as Sample[];
  await Promise.all(
    names.map(async (name) => {
      try {
        const res = await fetch(`/sounds/${name}.mp3`);
        samples.set(name, await audio.decodeAudioData(await res.arrayBuffer()));
      } catch (e) {
        console.warn(`sound ${name} failed to load`, e);
      }
    }),
  );
}

// White noise: the raw material for wind and whooshes.
function makeNoise(audio: AudioContext, seconds: number) {
  const buffer = audio.createBuffer(1, audio.sampleRate * seconds, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function ready(): { audio: AudioContext; out: GainNode } | null {
  return ctx && master && enabled && ctx.state === "running" ? { audio: ctx, out: master } : null;
}

export function playSample(name: Sample, delaySec = 0) {
  const r = ready();
  const buffer = samples.get(name);
  if (!r || !buffer) return;
  const source = r.audio.createBufferSource();
  source.buffer = buffer;
  const gain = r.audio.createGain();
  gain.gain.value = SAMPLE_GAIN[name];
  source.connect(gain).connect(r.out);
  source.start(r.audio.currentTime + delaySec);
}

// ---------- Wind (the spin) ----------

export type Wind = { setSpeed: (speed: number) => void; stop: () => void };

const SILENT_WIND: Wind = { setSpeed: () => {}, stop: () => {} };

/**
 * Starts the wind for one spin. `setSpeed(0..1)` every frame: faster spins are
 * louder and brighter (the filter opens), like air rushing past.
 * Two layers: a hiss (band-pass, moves 350→2200 Hz) and a low rumble.
 */
export function startWind(): Wind {
  const r = ready();
  if (!r || !noise) return SILENT_WIND;
  const { audio, out } = r;
  const now = audio.currentTime;

  const source = audio.createBufferSource();
  source.buffer = noise;
  source.loop = true;

  const hiss = audio.createBiquadFilter();
  hiss.type = "bandpass";
  hiss.Q.value = 0.9;
  hiss.frequency.value = 350;
  const hissGain = audio.createGain();
  hissGain.gain.value = 0;

  const rumble = audio.createBiquadFilter();
  rumble.type = "lowpass";
  rumble.frequency.value = 160;
  const rumbleGain = audio.createGain();
  rumbleGain.gain.value = 0;

  source.connect(hiss).connect(hissGain).connect(out);
  source.connect(rumble).connect(rumbleGain).connect(out);
  source.start(now);

  let stopped = false;
  return {
    setSpeed(speed) {
      if (stopped) return;
      const v = Math.min(1, Math.max(0, speed));
      const t = audio.currentTime;
      // setTargetAtTime glides to the value instead of jumping: no zipper noise,
      // and the first call fades the wind in rather than starting it abruptly.
      hiss.frequency.setTargetAtTime(350 + 1850 * v * v, t, 0.06);
      hissGain.gain.setTargetAtTime(0.32 * Math.pow(v, 1.3), t, 0.08);
      rumbleGain.gain.setTargetAtTime(0.5 * v, t, 0.08);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const t = audio.currentTime;
      hissGain.gain.setTargetAtTime(0, t, 0.05);
      rumbleGain.gain.setTargetAtTime(0, t, 0.05);
      source.stop(t + 0.4);
    },
  };
}

// ---------- Landing ----------

/** The moment the globe stops: a soft low thump and a small two-note bell. */
export function playLanding() {
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  const t = audio.currentTime;

  // Thump: a sine wave whose pitch falls quickly (150 → 45 Hz), like a soft drum.
  const thump = audio.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(150, t);
  thump.frequency.exponentialRampToValueAtTime(45, t + 0.32);
  const thumpGain = audio.createGain();
  thumpGain.gain.setValueAtTime(0.0001, t);
  thumpGain.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  thump.connect(thumpGain).connect(out);
  thump.start(t);
  thump.stop(t + 0.6);

  // Bell: two notes (E6, B6), each a pure tone plus a quieter, slightly "off"
  // overtone (×2.76), which is what makes metal sound like metal.
  [
    { freq: 1318.5, at: 0.02 },
    { freq: 1975.5, at: 0.11 },
  ].forEach(({ freq, at }) => {
    for (const [ratio, level] of [
      [1, 0.09],
      [2.76, 0.025],
    ]) {
      const osc = audio.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;
      const g = audio.createGain();
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(level, t + at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + (ratio === 1 ? 1.8 : 0.7));
      osc.connect(g).connect(out);
      osc.start(t + at);
      osc.stop(t + at + 2);
    }
  });
}

/** A short rising whoosh while the camera dives in after landing. */
export function playZoom(durationMs: number) {
  const r = ready();
  if (!r || !noise) return;
  const { audio, out } = r;
  const t = audio.currentTime;
  const d = durationMs / 1000;

  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(2600, t + d);
  const g = audio.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + d * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  source.connect(filter).connect(g).connect(out);
  source.start(t, Math.random()); // start somewhere random in the noise
  source.stop(t + d + 0.05);
}
