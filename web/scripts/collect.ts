// Daily collector: runs the pipeline (scripts/lib/pipeline.ts) for every enabled
// outlet, a few at a time, then saves the articles and a per-outlet health report.
// Run with `npm run collect`. Without ANTHROPIC_API_KEY it still works, but every
// article is kept with a neutral score and pinned to its outlet's base city.

import Anthropic from "@anthropic-ai/sdk";
import { OUTLETS } from "../src/lib/outlets";
import { pruneSummaries, saveArticles, saveHealth, storeKind } from "../src/lib/store";
import { mapLimit, processOutlet, type OutletReport } from "./lib/pipeline";

const OUTLETS_AT_ONCE = 8; // ~110 outlets: about 5 minutes

function line(r: OutletReport) {
  const status = !r.ok ? "FAILED" : r.kept === 0 ? "EMPTY " : "ok    ";
  return (
    `${status} ${r.id.padEnd(16)} feed ${String(r.feedItems).padStart(3)} → fresh ${String(r.afterRules).padStart(2)}` +
    ` → paywall -${String(r.paywalled).padStart(2)} → AI -${String(r.rejectedByAi).padStart(2)}` +
    ` → kept ${String(r.kept).padStart(2)} (photos ${r.photos}, places ${r.placeFromAi}${r.placeRejected ? `, rejected ${r.placeRejected}` : ""})` +
    `  ${(r.ms / 1000).toFixed(1)}s`
  );
}

async function main() {
  const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  if (!client) console.warn("ANTHROPIC_API_KEY is not set: skipping AI scoring (all articles kept, pinned to outlet city).");
  const started = Date.now();
  console.log(`Saving to: ${storeKind === "cloud" ? "Vercel Blob (production)" : "web/data/ (this computer)"}`);

  const results = await mapLimit(OUTLETS, OUTLETS_AT_ONCE, async (outlet) => {
    const result = await processOutlet(outlet, client);
    console.log(line(result.report));
    for (const err of result.report.errors) console.log(`       ! ${err}`);
    return result;
  });

  const articles = results.flatMap((r) => r.articles);
  const okOutlets = results.filter((r) => r.report.ok).length;
  // Safety net: if most outlets failed (network trouble, or a host blocking the
  // runner), keep yesterday's articles instead of replacing them with a few.
  // Exiting with an error marks the GitHub Actions run as failed, which sends an email.
  if (okOutlets < OUTLETS.length / 2) {
    await saveHealth({ runAt: new Date().toISOString(), outlets: results.map((r) => r.report) });
    throw new Error(`Only ${okOutlets} of ${OUTLETS.length} outlets succeeded; the saved articles were left as they were.`);
  }
  await saveArticles(articles);
  // Summaries of articles that are no longer served are never asked for again.
  // (Letters a reader already received keep their own copy in the browser.)
  const pruned = await pruneSummaries(new Set(articles.map((a) => a.id)));
  if (pruned) console.log(`Removed ${pruned} summaries of articles no longer served.`);
  await saveHealth({ runAt: new Date().toISOString(), outlets: results.map((r) => r.report) });
  console.log(`\nSaved ${articles.length} articles from ${OUTLETS.length} outlets in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
