import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    include: ["scripts/__tests__/**/*.test.ts"],
  },
});
