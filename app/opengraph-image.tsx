import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";
export const alt = "CyberBLADE — Practical Cybersecurity & Threat Intelligence Range";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundColor: "#080d14",
          padding: "60px 80px",
          fontFamily: "monospace",
          border: "4px solid #1c2738",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              backgroundColor: "#00d4ff",
            }}
          />
          <span style={{ color: "#00d4ff", fontSize: 24, letterSpacing: "4px" }}>
            CYBERBLADE // OPERATOR CONSOLE
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h1
            style={{
              fontSize: 68,
              fontWeight: 900,
              color: "#e2eaf4",
              margin: 0,
              letterSpacing: "-2px",
            }}
          >
            {BRAND.name}
          </h1>
          <p
            style={{
              fontSize: 28,
              color: "#7e91a6",
              margin: 0,
              maxWidth: "900px",
            }}
          >
            {BRAND.tagline}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            borderTop: "2px solid #1c2738",
            paddingTop: "24px",
          }}
        >
          <span style={{ color: "#a4b4c7", fontSize: 18 }}>
            TERMINAL · PACKET · WEBAPP · SIEM
          </span>
          <span style={{ color: "#10b981", fontSize: 18 }}>
            ALIGNMENT: SEC+ · NET+ · A+ · CC
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
