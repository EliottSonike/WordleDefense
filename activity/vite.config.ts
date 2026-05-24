import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  build: { outDir: "../server/dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true }
    }
  },
  define: {
    "import.meta.env.VITE_DISCORD_CLIENT_ID": JSON.stringify(process.env.DISCORD_CLIENT_ID ?? "")
  }
});
