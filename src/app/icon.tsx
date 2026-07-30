import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#c2673f",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            width: 18,
            height: 9,
            borderRadius: 4.5,
            background: "#f6f4ec",
            transform: "rotate(-45deg)",
            display: "flex",
          }}
        >
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: "4.5px 0 0 4.5px",
              background: "#c2673f",
              opacity: 0.35,
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
