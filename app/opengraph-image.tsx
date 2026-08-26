import { ImageResponse } from "next/og";
import { getArticleBySlug } from "@/lib/articles";

// Note: no edge runtime here — the mongodb driver needs Node's TCP APIs,
// which aren't available in the edge runtime. Runs as a regular Node route.
export const alt = "Paper Trail article cover";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params?: Promise<{ slug: string }>;
}) {
  const slug = (await params)?.slug;
  const article = slug ? await getArticleBySlug(slug) : null;

  const title = article?.title || "Paper Trail";
  const headline = article?.headline || "Research, translated.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#EEF0F2",
          padding: "72px",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#5B6B73",
            fontFamily: "monospace",
          }}
        >
          Paper Trail · Field Notes
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <div
            style={{
              fontSize: 58,
              fontWeight: 500,
              lineHeight: 1.15,
              color: "#16213D",
              display: "flex",
            }}
          >
            {title.length > 90 ? title.slice(0, 87) + "…" : title}
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#4A5568",
              lineHeight: 1.4,
              display: "flex",
              fontFamily: "sans-serif",
            }}
          >
            {headline.length > 140 ? headline.slice(0, 137) + "…" : headline}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div style={{ width: 48, height: 4, backgroundColor: "#C63D2F", display: "flex" }} />
          <div
            style={{
              fontSize: 18,
              fontFamily: "monospace",
              color: "#C63D2F",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            Translated from arXiv
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
