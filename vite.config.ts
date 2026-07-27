import { defineConfig } from "vite-plus";

export default defineConfig({
  server: {
    port: 9696,
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/blockly")) {
            return "vendor-blockly";
          }

          if (id.includes("node_modules/@carbon")) {
            return "vendor-carbon";
          }

          if (id.includes("/src/editor/")) {
            return "editor";
          }

          if (id.includes("/src/runtime/")) {
            return "runtime";
          }
        },
      },
    },
  },
  fmt: {
    ignorePatterns: ["vendor/**", "public/wasm/**"],
  },
  lint: {
    ignorePatterns: ["vendor/**", "public/wasm/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
