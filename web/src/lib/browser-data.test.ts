import { describe, expect, it } from "vitest";
import { groupLetters, type Letter } from "./letters";
import { roundForRequest } from "./settings";

function letter(id: string, lat: number, lng: number): Letter {
  return {
    id,
    title: id,
    url: `https://example.com/${id}`,
    outletName: "x",
    countryCode: "jp",
    lang: "ja",
    place: { city: "X", lat, lng },
    image: null,
    summary: "",
    summaryLang: "ja",
    receivedAt: 0,
  };
}

describe("groupLetters", () => {
  it("puts letters from the same city under one light", () => {
    const lights = groupLetters([letter("a", 35.68, 139.69), letter("b", 35.7, 139.7)]);
    expect(lights).toHaveLength(1);
    expect(lights[0].letters.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("keeps different cities apart", () => {
    // Tokyo and Osaka: far apart, two lights.
    const lights = groupLetters([letter("tokyo", 35.68, 139.69), letter("osaka", 34.69, 135.5)]);
    expect(lights).toHaveLength(2);
  });
});

describe("roundForRequest", () => {
  it("rounds a pinned place to 0.1° before it leaves the browser", () => {
    expect(roundForRequest({ lat: 46.589099999, lng: -129.69679 })).toEqual({ lat: 46.6, lng: -129.7 });
  });
});
