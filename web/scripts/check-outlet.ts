// Try one outlet without saving anything: shows how many articles survive each step
// and a few examples, using exactly the same pipeline as the daily collection.
//
//   npm run check-outlet -- okinawatimes            an outlet in outlets.ts (enabled or not)
//   npm run check-outlet -- okinawatimes --no-ai    skip the AI scoring (free, faster)
//   npm run check-outlet -- --feed <url> --country jp --lang ja
//                                                   a feed that isn't in outlets.ts yet

import Anthropic from "@anthropic-ai/sdk";
import { COUNTRIES, isCountryCode } from "../src/lib/countries";
import { outletById, type Outlet } from "../src/lib/outlets";
import { processOutlet } from "./lib/pipeline";

// process.argv = ["node", "scripts/check-outlet.ts", ...what you typed after `--`]
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function adHocOutlet(): Outlet {
  const feed = flag("feed")!;
  const code = flag("country") ?? "";
  if (!isCountryCode(code)) throw new Error(`--country must be one of: ${Object.keys(COUNTRIES).join(", ")}`);
  const [south, west, north, east] = COUNTRIES[code].bbox;
  return {
    id: "adhoc",
    name: new URL(feed).hostname,
    countryCode: code,
    country: COUNTRIES[code].name,
    lang: flag("lang") ?? "en",
    baseCity: "(unknown)",
    baseLat: (south + north) / 2,
    baseLng: (west + east) / 2,
    feeds: [feed],
    enabled: false,
    rules: {},
  };
}

async function main() {
  const id = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
  const outlet = flag("feed") ? adHocOutlet() : id ? outletById(id) : undefined;
  if (!outlet) {
    console.error("Usage: npm run check-outlet -- <outlet id> [--no-ai]\n       npm run check-outlet -- --feed <url> --country <code> --lang <code>");
    process.exit(1);
  }

  const useAi = !args.includes("--no-ai") && !!process.env.ANTHROPIC_API_KEY;
  console.log(`Checking ${outlet.name} (${outlet.country})${useAi ? "" : " — without AI scoring"} ...\n`);
  const { articles, report: r } = await processOutlet(outlet, useAi ? new Anthropic() : null);

  console.log(`feed items          ${r.feedItems}${r.ok ? "" : "   ← no feed could be read"}`);
  console.log(`after rules/48h     ${r.afterRules}`);
  console.log(`paywalled           -${r.paywalled}`);
  console.log(`rejected by AI      -${r.rejectedByAi}${r.scored ? "" : "   (not scored)"}`);
  console.log(`kept                ${r.kept}`);
  console.log(`  with own photo    ${r.photos}`);
  console.log(`  place from AI     ${r.placeFromAi}${r.placeRejected ? `   (rejected ${r.placeRejected}: outside the country)` : ""}`);
  console.log(`time                ${(r.ms / 1000).toFixed(1)}s`);
  if (r.errors.length) console.log(`\nproblems:\n${r.errors.map((e) => `  ! ${e}`).join("\n")}`);

  console.log(`\nexamples:`);
  for (const a of articles.slice(0, 5)) {
    console.log(`  [${a.score}] ${a.title}`);
    console.log(`      ${a.place.city}${a.place.source === "outlet" ? " (outlet base)" : ""} · photo: ${a.image ? "own" : a.fallbackImage ? "place photo" : "none"} · ${a.description ? "has description" : "no description"}`);
    console.log(`      ${a.url}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
