import type { NextRequest } from "next/server";
import { drawArticle } from "@/lib/draw";
import { loadArticles } from "@/lib/store";
import type { DrawResult } from "@/lib/types";

// GET /api/draw?recent=id1,id2,...
// HTTP only: read the request, load the articles, hand both to the draw rules
// (src/lib/draw.ts), and send back just what the screen needs.
export async function GET(req: NextRequest) {
  // Recently drawn article ids, newest first (sent by the browser).
  const recentIds = (req.nextUrl.searchParams.get("recent") ?? "").split(",").filter(Boolean);

  const article = drawArticle(await loadArticles(), recentIds);
  if (!article) {
    return Response.json({ error: "No articles collected yet. Run `npm run collect`." }, { status: 503 });
  }

  const result: DrawResult = {
    id: article.id,
    outletName: article.outletName,
    country: article.country,
    countryCode: article.countryCode,
    lang: article.lang,
    title: article.title,
    url: article.url,
    image: article.image,
    fallbackImage: article.fallbackImage,
    place: article.place,
  };
  return Response.json(result);
}
