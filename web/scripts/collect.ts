// Daily collector: runs the pipeline (scripts/lib/pipeline.ts) for every enabled
// outlet, a few at a time, then saves the articles and a per-outlet health report.
// Run with `npm run collect`. Without ANTHROPIC_API_KEY it still works, but every
// article is kept with a neutral score and pinned to its outlet's base city.

import Anthropic from "@anthropic-ai/sdk";
import { OUTLETS } from "../src/lib/outlets";
import { saveArticles, saveHealth } from "../src/lib/store";
import { mapLimit, processOutlet, type OutletReport } from "./lib/pipeline";

const OUTLETS_AT_ONCE = 4;

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

  const results = await mapLimit(OUTLETS, OUTLETS_AT_ONCE, async (outlet) => {
    const result = await processOutlet(outlet, client);
    console.log(line(result.report));
    for (const err of result.report.errors) console.log(`       ! ${err}`);
    return result;
  });

  const articles = results.flatMap((r) => r.articles);
  await saveArticles(articles);
  await saveHealth({ runAt: new Date().toISOString(), outlets: results.map((r) => r.report) });
  console.log(`\nSaved ${articles.length} articles from ${OUTLETS.length} outlets in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
