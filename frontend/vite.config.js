import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In local development the Express API runs on :3000 and is proxied under /api
// so the browser sees a single origin (same as production on Vercel).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: process.env.VITE_API_PROXY || "http://localhost:3000", changeOrigin: false },
      "/uploads": { target: process.env.VITE_API_PROXY || "http://localhost:3000", changeOrigin: false },
    },
  },
});
