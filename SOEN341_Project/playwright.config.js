import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.test.js",   // only top-level tests/, not tests/unit/
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
});
