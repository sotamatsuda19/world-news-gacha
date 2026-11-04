// Checks every enabled outlet's robots.txt: the feed's site, and the sites its articles
// live on (read from the feed, without fetching any article page). Run with
// `npm run check-robots`. The collector enforces the same rule on every run; this is the
// overview for deciding which outlets to disable or replace (decisions.md, 2026-11-04).

import { OUTLETS } from "../src/lib/outlets";
import { fetchFeed, mapLimit } from "./lib/pipeline";
import { checkRobots, type RobotsVerdict } from "./lib/robots";

async function verdictFor(feeds: string[]): Promise<RobotsVerdict> {
  const feedVerdict = await checkRobots(feeds);
  if (feedVerdict.blocking.length || feedVerdict.unknown.length) return feedVerdict;
  const items = (await Promise.allSettled(feeds.map(fetchFeed))).flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return checkRobots(items.slice(0, 60).map((it) => it.url));
}

async function main() {
  const results = await mapLimit(OUTLETS, 8, async (o) => ({ outlet: o, verdict: await verdictFor(o.feeds) }));
  let blocked = 0;
  let unknown = 0;
  for (const { outlet, verdict } of results) {
    if (verdict.blocking.length) {
      blocked++;
      console.log(`✖ ${outlet.id} (${outlet.country})`);
      for (const w of verdict.blocking) console.log(`    ${w}`);
    } else if (verdict.unknown.length) {
      unknown++;
      console.log(`? ${outlet.id} (${outlet.country})`);
      for (const w of verdict.unknown) console.log(`    ${w}`);
    }
  }
  console.log(`\n${OUTLETS.length} outlets: ${blocked} turn away Anthropic's crawlers or all bots, ${unknown} could not be confirmed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
