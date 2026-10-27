import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// envPrefix also accepts the old NEXT_PUBLIC_* names, so your existing .env.local keeps working.
export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "@shared": path.resolve(__dirname, "shared") } },
  server: { port: 3000, proxy: { "/api": "http://localhost:3001" } },
  build: { target: "es2020", sourcemap: false, rollupOptions: { output: { manualChunks: { react: ["react", "react-dom", "react-router-dom"], supabase: ["@supabase/supabase-js"] } } } },
});
