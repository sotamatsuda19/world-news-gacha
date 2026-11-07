// Renders the README's diagram drafts (scripts/media/diagrams/*.html) to PNG
// (1600×900, drawn at 2× for sharp text) in ../docs/architecture-drafts/.
// Run from web/:  node scripts/media/make-diagrams.mjs [name ...]   e.g. "s1-stack#f3" (the README's, copied to docs/images/architecture.png)
//
// Like make-og.mjs, the pages are opened from a temporary folder that also holds the
// Earth texture and a browser build of src/lib/earth-gl.ts.

import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openPage } from "./chrome.mjs";

const SRC = "scripts/media/diagrams";
const OUT = "../docs/architecture-drafts";
mkdirSync(OUT, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), "newsgacha-diagrams-"));
try {
  execFileSync("node_modules/.bin/esbuild", ["src/lib/earth-gl.ts", "--bundle", "--format=iife", "--global-name=EarthGL", `--outfile=${join(dir, "earth-gl.js")}`, "--log-level=warning"]);
  copyFileSync("public/textures/earth-2k.jpg", join(dir, "earth-2k.jpg"));
  for (const f of readdirSync(SRC, { withFileTypes: true })) if (f.isFile()) copyFileSync(join(SRC, f.name), join(dir, f.name));
  cpSync(join(SRC, "icons"), join(dir, "icons"), { recursive: true, filter: (p) => !p.includes(".claude") }); // brand icons (Simple Icons, CC0)

  const wanted = process.argv.slice(2);
  // A name may carry a variant after "#" (s1-stack#f1): the page reads it from its URL,
  // and the PNG is named s1-stack-f1.png.
  const pages = wanted.length
    ? wanted
    : readdirSync(SRC)
        .filter((f) => f.endsWith(".html"))
        .map((f) => f.replace(/\.html$/, ""));

  const page = await openPage({ width: 1600, height: 900, scale: 2 });
  try {
    for (const name of pages) {
      const [base, variant] = name.split("#");
      await page.go("about:blank"); // a change of "#" alone would not reload the page
      await page.go(`file://${join(dir, `${base}.html`)}${variant ? `#${variant}` : ""}`);
      await page.until("window.ready");
      const file = `${OUT}/${variant ? `${base}-${variant}` : base}.png`;
      await page.shot(file);
      console.log(`${file}  ${Math.round(statSync(file).size / 1024)} KB`);
    }
  } finally {
    await page.close();
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
