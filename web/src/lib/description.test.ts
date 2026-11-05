// Description cleaning (scripts/lib/description.ts) and the summary text helpers
// (summary-prompt.ts). The examples are shaped like real collected descriptions.
import { describe, expect, it } from "vitest";
import { cleanDescription } from "../../scripts/lib/description";
import { summaryUserMessage, tidyLineBreaks } from "./summary-prompt";
import type { Article } from "./types";

describe("cleanDescription", () => {
  it("drops a CDATA wrapper, and the result if it only repeats the headline", () => {
    const title = "Різдво та Новий рік у Тернополі будуть вихідними";
    expect(cleanDescription(`[CDATA[ ${title}]]>`, title)).toBe("");
    expect(cleanDescription("[CDATA[ Суд обрав запобіжний захід. Деталі згодом.]]>", "Інше")).toBe(
      "Суд обрав запобіжний захід. Деталі згодом.",
    );
  });

  it("removes the WordPress footer and the cut-off marker before it", () => {
    const d =
      "Polisi menangkap dua pelaku. Mereka menggadaikan mobil sewaan karena […] The post Gadaikan Mobil Sewaan appeared first on Balipuspanews.com .";
    expect(cleanDescription(d, "Gadaikan Mobil Sewaan")).toBe("Polisi menangkap dua pelaku.");
  });

  it("removes the footer in other languages, and after a stray <p>", () => {
    expect(
      cleanDescription(
        "Die Stadt hat sich verständigt. Und […] Der Beitrag Der Stadtrat tagt erschien zuerst auf Leipziger Zeitung.",
        "Der Stadtrat tagt",
      ),
    ).toBe("Die Stadt hat sich verständigt.");
    expect(cleanDescription("Agenda ini digelar. Permohonan […] <p>The post Workshop musik appeared first on X.", "y")).toBe(
      "Agenda ini digelar.",
    );
  });

  it("removes a footer that was itself cut off", () => {
    expect(cleanDescription("Kunjungan ini digelar. Kunjungan ini bertujuan untuk meninjau secara […] <p>The post Riset Austra", "y")).toBe(
      "Kunjungan ini digelar.",
    );
  });

  it("removes 'read more' links in several languages", () => {
    expect(cleanDescription("Bir tabanca ele geçirildi. Devamı için tıklayınız", "x")).toBe("Bir tabanca ele geçirildi.");
    expect(cleanDescription("Le maire a démissionné. Lire la suite »", "x")).toBe("Le maire a démissionné.");
    expect(cleanDescription("新しい橋が開通しました。続きを読む", "x")).toBe("新しい橋が開通しました。");
  });

  it("trims text cut off mid-sentence back to the last full sentence", () => {
    expect(cleanDescription("秋田市で菊まつりが始まりました。県内の愛好家が丹精込めて育てたおよそ１ […]", "x")).toBe(
      "秋田市で菊まつりが始まりました。",
    );
    expect(cleanDescription("He said the decision took a heavy toll on his finances, even asking...", "x")).toBe(
      "He said the decision took a heavy toll on his finances, even asking",
    );
  });

  it("keeps an ordinary description as it is", () => {
    const d = "The council approved the new bus lane on Tuesday. Work starts in March.";
    expect(cleanDescription(d, "New bus lane approved")).toBe(d);
  });

  it("treats a description that is the headline again as none", () => {
    const title = "China's first phoenix: a jade treasure from 4,000 years ago";
    expect(cleanDescription(title, title)).toBe("");
    expect(cleanDescription("China’s first phoenix — a jade treasure from 4,000 years ago", title)).toBe("");
  });
});

describe("tidyLineBreaks", () => {
  it("turns blank lines into single line breaks", () => {
    expect(tidyLineBreaks("One.\n\nTwo.\n \nThree.", false)).toBe("One.\nTwo.\nThree.");
  });

  it("catches a blank line split across two streamed pieces", () => {
    let sent = "";
    for (const piece of ["First line.\n", "\nSecond", " line."]) {
      sent += tidyLineBreaks(piece, /\n\s*$/.test(sent) || !sent.trim());
    }
    expect(sent).toBe("First line.\nSecond line.");
  });

  it("drops line breaks before the first line", () => {
    expect(tidyLineBreaks("\n\nHello", true)).toBe("Hello");
  });
});

describe("summaryUserMessage", () => {
  const article = {
    title: "Jade phoenix found",
    description: "Jade phoenix found",
    outletName: "X",
    country: "China",
    place: { city: "Beijing", lat: 0, lng: 0, source: "ai" },
  } as Article;

  it("says there is no description when it only repeats the headline", () => {
    expect(summaryUserMessage(article, "ja")).toContain("Description: (none)");
  });

  it("names Chinese as Simplified Chinese", () => {
    expect(summaryUserMessage(article, "zh")).toContain("Reader's language: Simplified Chinese");
  });
});
