// Reads a site's robots.txt and reports whether it asks Anthropic's crawlers (or every
// crawler) to stay away from the feeds we read.
//
// Policy (decisions.md, 2026-11-04): this app sends each article's headline and summary
// to Claude, so a site that turns away Anthropic's agents — or all bots — is not used,
// even though the collector could technically fetch it. Rules aimed only at other AI
// companies' bots (GPTBot, CCBot…) are reported for information but don't block.

const ANTHROPIC_BOTS = /^(claudebot|claude-web|claude-user|claude-searchbot|anthropic-ai)$/i;
const OTHER_AI_BOTS =
  /^(gptbot|chatgpt-user|oai-searchbot|ccbot|google-extended|perplexitybot|bytespider|meta-externalagent|applebot-extended|amazonbot|cohere-ai)$/i;

const ROBOTS_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export type RobotsVerdict = {
  /** Reasons the outlet must not be used. Empty = allowed. */
  blocking: string[];
  /** Hosts whose robots.txt couldn't be read (error, redirect loop, 403/5xx). Not confirmed = don't use yet. */
  unknown: string[];
  /** Rules against other companies' AI bots; don't affect us. */
  info: string[];
};

/** Splits robots.txt into groups of (user agents → disallowed paths). */
export function parseRobots(body: string): { agents: string[]; disallow: string[] }[] {
  const groups: { agents: string[]; disallow: string[] }[] = [];
  let current: { agents: string[]; disallow: string[] } | null = null;
  let lastWasAgent = false;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, field, value] = m;
    if (field.toLowerCase() === "user-agent") {
      // Consecutive User-agent lines share one group.
      if (!current || !lastWasAgent) groups.push((current = { agents: [], disallow: [] }));
      current.agents.push(value.trim());
      lastWasAgent = true;
    } else {
      if (current && field.toLowerCase() === "disallow" && value.trim()) current.disallow.push(value.trim());
      lastWasAgent = false;
    }
  }
  return groups;
}

/** Judges one site, given its robots.txt text and the paths we'd fetch (the feeds). */
export function judgeRobots(body: string, paths: string[]): RobotsVerdict {
  const verdict: RobotsVerdict = { blocking: [], unknown: [], info: [] };
  for (const g of parseRobots(body)) {
    const covers = g.disallow.includes("/") || paths.some((p) => g.disallow.some((d) => p.startsWith(d)));
    if (!covers) continue;
    const where = g.disallow.includes("/") ? "the whole site" : "the feed";
    const anthropic = g.agents.filter((a) => ANTHROPIC_BOTS.test(a));
    const others = g.agents.filter((a) => OTHER_AI_BOTS.test(a));
    if (anthropic.length) verdict.blocking.push(`blocks Anthropic's crawlers (${anthropic.join(", ")}) from ${where}`);
    if (g.agents.includes("*")) verdict.blocking.push(`blocks all crawlers (*) from ${where}`);
    if (others.length) verdict.info.push(`blocks other AI crawlers (${others.join(", ")})`);
  }
  return verdict;
}

// Checks every host involved: the feed's, and the articles' when they live elsewhere
// (e.g. Vaalweekblad's feed points to articles on citizen.co.za).
// No robots.txt (404/410) means nothing is asked; any other failure is "unknown".
// One fetch per site per run, however many outlets or articles point at it.
const robotsCache = new Map<string, Promise<{ status: "none" } | { status: "text"; body: string } | { status: "error"; reason: string }>>();

function fetchRobots(origin: string) {
  if (!robotsCache.has(origin)) {
    robotsCache.set(
      origin,
      (async () => {
        try {
          // Same User-Agent as the collector's other requests, so the answer is the one that applies to them.
          const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": ROBOTS_UA }, signal: AbortSignal.timeout(10000) });
          if (res.status === 404 || res.status === 410) return { status: "none" as const };
          if (!res.ok) return { status: "error" as const, reason: `robots.txt answered HTTP ${res.status}` };
          return { status: "text" as const, body: await res.text() };
        } catch (e) {
          const err = e as Error & { cause?: Error };
          return { status: "error" as const, reason: `robots.txt could not be read (${err.cause?.message ?? err.message})` };
        }
      })(),
    );
  }
  return robotsCache.get(origin)!;
}

export async function checkRobots(urls: string[]): Promise<RobotsVerdict> {
  const byOrigin = new Map<string, string[]>();
  for (const u of urls) {
    try {
      const url = new URL(u);
      byOrigin.set(url.origin, [...(byOrigin.get(url.origin) ?? []), url.pathname]);
    } catch {
      // not a URL: skip
    }
  }
  const verdict: RobotsVerdict = { blocking: [], unknown: [], info: [] };
  for (const [origin, paths] of byOrigin) {
    const host = new URL(origin).host;
    const robots = await fetchRobots(origin);
    if (robots.status === "none") continue;
    if (robots.status === "error") {
      verdict.unknown.push(`${host}: ${robots.reason}`);
      continue;
    }
    const v = judgeRobots(robots.body, [...new Set(paths)]);
    verdict.blocking.push(...v.blocking.map((b) => `${host}: ${b}`));
    verdict.info.push(...v.info.map((i) => `${host}: ${i}`));
  }
  return verdict;
}
