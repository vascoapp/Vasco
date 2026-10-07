import { ImageResponse } from "next/og";

// Site-wide Open Graph / Twitter card image. Child routes inherit it unless
// they define their own. Default system font: next/og cannot read the
// self-hosted TTFs without a file read, and a wordmark this size does not
// need one.

export const alt = "Vasco — Quotes, invoices and e-invoicing for the trades";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#0B0E11",
        }}
      >
        <div
          style={{
            fontSize: 160,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            color: "#F97316",
            lineHeight: 1,
          }}
        >
          Vasco
        </div>
        <div style={{ marginTop: 32, fontSize: 52, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.2 }}>
          Quotes, invoices and e-invoicing for the trades
        </div>
        <div style={{ marginTop: 28, fontSize: 30, color: "#9CA3AF" }}>
          NL · DE · FR · ES · IT · UK
        </div>
      </div>
    ),
    size,
  );
}
