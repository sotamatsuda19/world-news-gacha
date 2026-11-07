// Makes the share image (what LINE, X and others show for a link to the site):
// src/app/opengraph-image.png, 1200×630, from scripts/media/og.html.
// Run from web/:  node scripts/media/make-og.mjs
//
// The page is opened from a temporary folder holding og.html, the Earth texture and
// a browser build of src/lib/earth-gl.ts, so the Earth looks exactly like the app's.

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openPage } from "./chrome.mjs";

const OUT = "src/app/opengraph-image.png";
const dir = mkdtempSync(join(tmpdir(), "newsgacha-og-"));
try {
  execFileSync("node_modules/.bin/esbuild", ["src/lib/earth-gl.ts", "--bundle", "--format=iife", "--global-name=EarthGL", `--outfile=${join(dir, "earth-gl.js")}`, "--log-level=warning"]);
  copyFileSync("scripts/media/og.html", join(dir, "og.html"));
  copyFileSync("public/textures/earth-2k.jpg", join(dir, "earth-2k.jpg"));

  const page = await openPage({ width: 1200, height: 630 });
  try {
    await page.go(`file://${join(dir, "og.html")}`);
    await page.until("window.ready");
    await page.shot(OUT);
  } finally {
    await page.close();
  }
  console.log(`${OUT}  ${Math.round(statSync(OUT).size / 1024)} KB`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
