import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import manifestJson from "./public/manifest.json";

// Create a properly typed version of the manifest
const manifest = {
  ...manifestJson,
  // Explicitly set the type to "module" as a string literal
  background: {
    ...manifestJson.background,
    type: "module" as const, // Type assertion to ensure it's the literal "module"
  },
};

export default defineConfig({
  plugins: [react(), crx({ manifest }), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@swig/coder": path.resolve(__dirname, "../../packages/coder/src"),
      "@solana/kit": path.resolve(__dirname, "../../packages/kit/src"),
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        // Add the wallet standard script as an additional entry point
        injectWalletStandard: path.resolve(
          __dirname,
          "src/pages/content/injectWalletStandard.ts"
        ),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep the original name for the wallet standard script
          if (chunkInfo.name === "injectWalletStandard") {
            return "injectWalletStandard.js";
          }
          return "[name].[hash].js";
        },
      },
    },
  },
});
