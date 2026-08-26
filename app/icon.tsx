import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#16213D",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontFamily: "serif",
            fontWeight: 600,
            color: "#EEF0F2",
            display: "flex",
          }}
        >
          P
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 4,
            right: 5,
            width: 8,
            height: 3,
            backgroundColor: "#C63D2F",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
