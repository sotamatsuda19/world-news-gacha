import { ImageResponse } from "next/og";

// The home-screen icon on iPhone (which wants a PNG): the same picture as icon.svg.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#02030a" }}>
        <div
          style={{
            width: 124,
            height: 124,
            borderRadius: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "4px solid rgba(255, 255, 255, 0.45)",
            background: "radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.05) 70%)",
          }}
        >
          <div
            style={{
              width: 74,
              height: 74,
              borderRadius: 9999,
              background: "radial-gradient(circle, #fff6df 0%, #ffd68c 42%, rgba(255, 214, 140, 0) 70%)",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
