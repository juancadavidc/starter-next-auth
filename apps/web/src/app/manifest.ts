import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "starter-next-auth",
    short_name: "starter-next-auth",
    start_url: "/app",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
