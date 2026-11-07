// A small headless-Chrome driver for making the pictures the repository shows (the
// share image, the README's screenshots and GIFs). Uses the Chrome already installed
// on this Mac and talks to it over a pipe (the DevTools protocol), so nothing extra
// is installed.
//
//   const page = await openPage({ width, height, scale });
//   await page.go(url); await page.shot("out.png"); await page.close();

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openPage({ width, height, scale = 1, mobile = false }) {
  const profile = mkdtempSync(join(tmpdir(), "newsgacha-chrome-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-pipe",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--mute-audio",
      "--allow-file-access-from-files", // og.html reads the Earth texture next to it
      "--autoplay-policy=no-user-gesture-required",
      "--enable-gpu",
      "--use-angle=metal",
      "--lang=ja",
      "--accept-lang=ja,en",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
  );
  const toChrome = proc.stdio[3];
  const fromChrome = proc.stdio[4];

  // Messages are JSON, each ended by a NUL byte.
  let id = 0;
  const waiting = new Map();
  const listeners = new Set();
  let buf = "";
  fromChrome.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let i;
    while ((i = buf.indexOf("\0")) >= 0) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      if (msg.id && waiting.has(msg.id)) {
        const { ok, fail } = waiting.get(msg.id);
        waiting.delete(msg.id);
        if (msg.error) fail(new Error(`${msg.error.message} ${msg.error.data ?? ""}`));
        else ok(msg.result);
      } else for (const l of listeners) l(msg);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((ok, fail) => {
      const n = ++id;
      waiting.set(n, { ok, fail });
      toChrome.write(JSON.stringify({ id: n, method, params, sessionId }) + "\0");
    });

  const { targetInfos } = await send("Target.getTargets");
  const target = targetInfos.find((t) => t.type === "page");
  const { sessionId } = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  const cmd = (method, params) => send(method, params, sessionId);
  const on = (method, fn) => {
    const l = (m) => m.sessionId === sessionId && m.method === method && fn(m.params);
    listeners.add(l);
    return () => listeners.delete(l);
  };

  await cmd("Page.enable");
  await cmd("Runtime.enable");
  await cmd("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile });
  await cmd("Emulation.setLocaleOverride", { locale: "ja-JP" }); // the app in Japanese
  if (mobile) await cmd("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

  const page = {
    cmd,
    on,
    async go(url) {
      const loaded = new Promise((r) => {
        const off = on("Page.loadEventFired", () => (off(), r()));
      });
      await cmd("Page.navigate", { url });
      await loaded;
    },
    async eval(expression) {
      const r = await cmd("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    // Wait until `expression` is true in the page (checked every 100 ms).
    async until(expression, ms = 20000) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (await page.eval(`!!(${expression})`)) return;
        await sleep(100);
      }
      const debug = join(tmpdir(), "newsgacha-timeout.png");
      await page.shot(debug).catch(() => {});
      throw new Error(`timed out waiting for: ${expression} (screen: ${debug})`);
    },
    async click(x, y) {
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
        await cmd("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    },
    async shot(file, format = "png") {
      const { data } = await cmd("Page.captureScreenshot", { format });
      writeFileSync(file, Buffer.from(data, "base64"));
    },
    // Record what the page shows: frames (JPEG) with their times, until stop() is called.
    async record(maxWidth = width, maxHeight = height) {
      const frames = [];
      const off = on("Page.screencastFrame", (p) => {
        frames.push({ data: p.data, t: p.metadata.timestamp });
        cmd("Page.screencastFrameAck", { sessionId: p.sessionId }).catch(() => {});
      });
      await cmd("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: maxWidth * scale, maxHeight: maxHeight * scale, everyNthFrame: 1 });
      return async () => {
        await cmd("Page.stopScreencast");
        off();
        return frames;
      };
    },
    async close() {
      const exited = new Promise((r) => proc.once("exit", r));
      send("Browser.close").catch(() => {});
      await Promise.race([exited, sleep(3000)]);
      proc.kill();
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
  return page;
}
