"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import type { UiLang } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { CONTACT_URL } from "@/lib/site";
import EarthBackdrop from "./EarthBackdrop";
import "./info-page.css";

// The plain reading pages linked from the about page's footer (/terms, /publishers),
// over a slowly turning Earth. Both languages come from the page (server components
// passed in as props); the one shown follows the reader's display language, like the
// about page. That setting lives in the browser, so the words appear once the page
// has loaded there (no flash of the other language).

type Both<T> = Record<UiLang, T>;

const NAV: Both<{ terms: string; publishers: string; contact: string; app: string }> = {
  ja: { terms: "ご利用にあたって", publishers: "掲載メディアの方へ", contact: "お問い合わせ", app: "手紙を受け取る →" },
  en: { terms: "Using NewsGacha", publishers: "For publishers", contact: "Contact", app: "Receive a letter →" },
};

const subscribeNothing = () => () => {};

export default function InfoPage({ title, lead, body }: { title: Both<string>; lead: Both<string>; body: Both<ReactNode> }) {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const { ui } = useSettings();
  const nav = NAV[ui];

  return (
    <div className="info">
      <EarthBackdrop />
      {mounted && (
        <main className="info-body" lang={ui}>
          <p className="info-site">
            <Link href="/">NewsGacha</Link>
          </p>
          <h1>{title[ui]}</h1>
          <p className="info-lead">{lead[ui]}</p>
          {body[ui]}
          <nav className="info-nav">
            <Link href="/terms">{nav.terms}</Link>
            <Link href="/publishers">{nav.publishers}</Link>
            <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">
              {nav.contact}
            </a>
            <Link href="/">{nav.app}</Link>
          </nav>
        </main>
      )}
    </div>
  );
}
