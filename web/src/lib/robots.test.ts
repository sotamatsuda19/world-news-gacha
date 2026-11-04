import { describe, expect, it } from "vitest";
import { judgeRobots, parseRobots } from "../../scripts/lib/robots";

describe("robots.txt check", () => {
  it("groups consecutive user-agent lines", () => {
    const groups = parseRobots("User-agent: ClaudeBot\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin");
    expect(groups).toEqual([
      { agents: ["ClaudeBot", "GPTBot"], disallow: ["/"] },
      { agents: ["*"], disallow: ["/admin"] },
    ]);
  });

  it("blocks when Anthropic's crawlers are turned away", () => {
    const v = judgeRobots("User-agent: anthropic-ai\nUser-agent: ClaudeBot\nDisallow: /", ["/rss"]);
    expect(v.blocking).toHaveLength(1);
    expect(v.blocking[0]).toMatch(/Anthropic's crawlers \(anthropic-ai, ClaudeBot\)/);
  });

  it("blocks when every crawler is turned away from the feed", () => {
    expect(judgeRobots("User-agent: *\nDisallow: /rss", ["/rss/news.xml"]).blocking[0]).toMatch(/all crawlers/);
  });

  it("only notes rules aimed at other AI companies", () => {
    const v = judgeRobots("User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /", ["/rss"]);
    expect(v.blocking).toEqual([]);
    expect(v.info[0]).toMatch(/GPTBot, CCBot/);
  });

  it("stays quiet for ordinary rules", () => {
    expect(judgeRobots("User-agent: *\nDisallow: /admin\nDisallow: /search", ["/rss"]).blocking).toEqual([]);
    expect(judgeRobots("User-agent: SomeSEOBot\nDisallow: /", ["/rss"]).blocking).toEqual([]);
    expect(judgeRobots("User-agent: *\nDisallow:", ["/rss"]).blocking).toEqual([]); // empty Disallow allows everything
  });
});
