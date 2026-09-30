import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#27548b",
          color: "#fff",
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: -2,
        }}
      >
        QS
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: 2, marginTop: 4 }}>
          QUICK SHINE
        </div>
      </div>
    ),
    size
  );
}
