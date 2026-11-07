// Records the README's GIFs and screenshots from the running app (npm run dev first).
// Run from web/:  node scripts/media/make-readme-media.mjs [scene ...]
// Scenes: hero (desktop draw), phone (the same on a phone, with stills before and
// after), about (the about story). With none given, all of them. Output: ../docs/images/.
//
// The app is used like a reader would: press the button, open the envelope, wait
// for the letter. Each run draws a different letter, so the pictures change each time.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openPage, sleep } from "./chrome.mjs";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const OUT = "../docs/images";
mkdirSync(OUT, { recursive: true });

// Frames (with their times) -> an optimised GIF `width` px wide at `fps`.
function gif(frames, file, { width, fps = 10 }) {
  const dir = mkdtempSync(join(tmpdir(), "newsgacha-frames-"));
  try {
    const list = [];
    frames.forEach((f, i) => {
      const name = `f${String(i).padStart(5, "0")}.jpg`;
      writeFileSync(join(dir, name), Buffer.from(f.data, "base64"));
      const next = frames[i + 1]?.t ?? f.t + 1.5; // hold the last frame a moment
      list.push(`file '${name}'`, `duration ${Math.max(0.001, next - f.t).toFixed(3)}`);
    });
    list.push(`file 'f${String(frames.length - 1).padStart(5, "0")}.jpg'`);
    writeFileSync(join(dir, "list.txt"), list.join("\n"));
    const filters = `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", filters, "-loop", "0", file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`${file}  ${frames.length} frames  ${(statSync(file).size / 1024 / 1024).toFixed(1)} MB`);
}

const centre = (page, selector) =>
  page.eval(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);

// Hidden while recording:
// - the dev server's own badge (in a corner): not part of the app;
// - the article's photo on the letter: it belongs to the newspaper. The app shows it
//   from the newspaper's site, next to a link to the article; copying it into the
//   repository would be republishing it. Letters without a photo look just like this.
const HIDE = "nextjs-portal,.card-photo{display:none!important}";
const hideDevBadge = (page) => page.eval(`document.head.insertAdjacentHTML("beforeend", "<style>${HIDE}</style>")`);

async function go(page, url) {
  await page.go(url);
  await hideDevBadge(page);
}

async function appReady(page) {
  await go(page, APP);
  await page.until(`document.querySelector(".gacha-button") && !document.querySelector(".gacha-dock[data-hidden]")`, 40000);
  await sleep(2500); // the globe settles
}

// Press the button, open the envelope when it has landed, wait for the whole letter.
async function drawOne(page) {
  await page.click(...(await centre(page, ".gacha-button")));
  await page.until(`document.querySelector(".envelope")`, 30000);
  await sleep(1900);
  await page.click(...(await centre(page, ".envelope")));
  await page.until(`document.querySelector(".card-about[data-shown]")`, 60000); // once the summary is typed out
  await sleep(1800);
}

const scenes = {
  async hero() {
    const page = await openPage({ width: 1200, height: 720 });
    try {
      await appReady(page);
      const stop = await page.record();
      await sleep(800);
      await drawOne(page);
      gif(await stop(), `${OUT}/draw.gif`, { width: 720 });
    } finally {
      await page.close();
    }
  },

  async phone() {
    const page = await openPage({ width: 390, height: 844, scale: 2, mobile: true });
    try {
      await appReady(page);
      await page.shot(`${OUT}/phone-globe.png`);
      const stop = await page.record();
      await sleep(600);
      await drawOne(page);
      gif(await stop(), `${OUT}/phone-draw.gif`, { width: 300 });
      await page.shot(`${OUT}/phone-letter.png`);
    } finally {
      await page.close();
    }
  },

  // The about page tells its story as you scroll: scroll through the first part
  // (the slogan, the lights, the letter's flight) at an even pace.
  async about() {
    const page = await openPage({ width: 1200, height: 720 });
    try {
      await go(page, `${APP}/about`);
      await page.until(`document.querySelector(".ab-hero h1")`);
      await sleep(2500);
      const stop = await page.record();
      await sleep(1200);
      await page.eval(`new Promise((done) => {
        const to = document.querySelector(".ab-story").offsetHeight * ${process.env.ABOUT_UNTIL ?? 0.455};
        const ms = ${process.env.ABOUT_MS ?? 15000}, t0 = performance.now();
        const step = (now) => {
          const k = Math.min(1, (now - t0) / ms);
          window.scrollTo(0, to * k);
          k < 1 ? requestAnimationFrame(step) : setTimeout(done, 5000);
        };
        requestAnimationFrame(step);
      })`);
      gif(await stop(), `${OUT}/about.gif`, { width: 640, fps: 8 });
    } finally {
      await page.close();
    }
  },
};

const wanted = process.argv.slice(2);
for (const name of wanted.length ? wanted : Object.keys(scenes)) {
  console.log(`-- ${name}`);
  await scenes[name]();
}
