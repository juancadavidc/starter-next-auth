import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Sitio estático: sin servidor, sin base de datos, sin sesiones. La app vive aparte.
export default defineConfig({
  vite: { plugins: [tailwindcss()] },
});
