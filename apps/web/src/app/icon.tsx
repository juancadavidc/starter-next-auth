import { ImageResponse } from "next/og";

// Ícono provisional generado: reemplázalo por el de la marca (icon.png en esta carpeta).
export const size = { width: 512, height: 512 };
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
          background: "#171717",
          color: "#fafafa",
          fontSize: 320,
          fontWeight: 700,
        }}
      >
        S
      </div>
    ),
    size,
  );
}
