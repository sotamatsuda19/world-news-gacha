import Link from "next/link";
import type { ReactNode } from "react";
import { CONTACT_URL } from "@/lib/site";
import "./info-page.css";

// The plain reading pages linked from the about page's footer (/terms, /publishers).
// Japanese only for now; English follows once the wording is settled.
export default function InfoPage({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <div className="info" lang="ja">
      <main className="info-body">
        <p className="info-site">
          <Link href="/">NewsGacha</Link>
        </p>
        <h1>{title}</h1>
        <p className="info-lead">{lead}</p>
        {children}
        <nav className="info-nav">
          <Link href="/terms">ご利用にあたって</Link>
          <Link href="/publishers">掲載メディアの方へ</Link>
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">
            お問い合わせ
          </a>
          <Link href="/">手紙を受け取る →</Link>
        </nav>
      </main>
    </div>
  );
}
