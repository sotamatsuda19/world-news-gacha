import type { NextRequest } from "next/server";
import { drawArticle, drawNear } from "@/lib/draw";
import { loadArticles } from "@/lib/store";
import type { DrawResult } from "@/lib/types";

// GET /api/draw?recent=id1,id2,...[&near=lat,lng]
// HTTP only: read the request, load the articles, hand both to the draw rules
// (src/lib/draw.ts), and send back just what the screen needs.
//
// `near` comes from a long press on the globe or from one of the reader's pinned
// places. The browser decides when to use a pinned place; the server only sees a
// rounded point and never learns whether it was a pin.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  // Recently drawn article ids, newest first (sent by the browser).
  const recentIds = (params.get("recent") ?? "").split(",").filter(Boolean);
  const near = parsePoint(params.get("near"));
  if (params.has("near") && !near) return Response.json({ error: "near must be lat,lng" }, { status: 400 });

  const articles = await loadArticles();
  // Nothing near the point (the open ocean): fall back to the usual draw.
  const article = (near && drawNear(articles, near, recentIds)) || drawArticle(articles, recentIds);
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

// "35.7,139.7" -> { lat: 35.7, lng: 139.7 }; anything malformed or out of range -> null.
function parsePoint(value: string | null): { lat: number; lng: number } | null {
  if (!value) return null;
  const [lat, lng] = value.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
