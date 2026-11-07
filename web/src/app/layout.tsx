import type { Metadata, Viewport } from "next";
import "flag-icons/css/flag-icons.min.css";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// What a shared link shows (LINE, X, search results): the name, this description, and
// the share image (opengraph-image.png next to this file, made by
// scripts/media/make-og.mjs). Japanese for now: the first showing is a Japanese
// hackathon. The pages themselves still follow the reader's language.
const description = "ボタンを押すと、地球のどこかの小さなニュースが、一通の手紙になって届きます。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "NewsGacha",
  description,
  openGraph: {
    title: "NewsGacha",
    description,
    siteName: "NewsGacha",
    type: "website",
    locale: "ja_JP",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#02030a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
