import * as cloud from "./cloud";
import * as file from "./file";

// Where articles and summaries are kept, chosen by the NEWS_STORE environment variable:
//
//   (not set)          JSON files in web/data/ — on this Mac        (./file.ts)
//   NEWS_STORE=cloud   Vercel Blob + Upstash Redis — in production  (./cloud.ts)
//
// It is set only on Vercel and in the GitHub Actions workflow. Choosing by an explicit
// switch (not by "is there a Blob token?") means a token pasted into .env.local can't
// make a local experiment overwrite the production data by accident.
//
// Everything else imports from "@/lib/store" and never knows which one it got.

const kind = process.env.NEWS_STORE ?? "file";
if (kind !== "file" && kind !== "cloud") {
  throw new Error(`NEWS_STORE must be "cloud" or unset, got "${kind}"`);
}
const store = kind === "cloud" ? cloud : file;

export const storeKind: "file" | "cloud" = kind;
export const { loadArticles, saveArticles, saveHealth, getSummary, putSummary, pruneSummaries } = store;
