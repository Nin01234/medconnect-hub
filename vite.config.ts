import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    target: "es2022",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, "/");
          if (!norm.includes("node_modules")) return;
          if (norm.includes("@supabase")) return "supabase";
          if (norm.includes("@tanstack")) return "tanstack-query";
          if (norm.includes("react-router")) return "react-router";
          if (norm.includes("node_modules/react-dom/")) return "react-dom";
          if (norm.includes("node_modules/react/")) return "react";
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
