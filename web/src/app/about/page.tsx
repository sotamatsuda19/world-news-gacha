import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import AboutStory from "@/components/about/AboutStory";
import { aboutData } from "@/lib/about/data";
import { loadArticles } from "@/lib/store";
import "./about.css";

export const metadata: Metadata = {
  title: "About — NewsGacha",
  description: "How a letter from a small town reaches you: a draw that knows nothing about you.",
};

// The lights and counts come from today's articles (the same ones /api/draw draws
// from), worked out at most once an hour: the articles change once a day, and the
// page doesn't need to load all of them for every visitor.
async function getAboutData() {
  "use cache";
  cacheLife("hours");
  return aboutData(await loadArticles());
}

export default async function AboutPage() {
  return <AboutStory data={await getAboutData()} />;
}
