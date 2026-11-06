import { resolve } from "node:path"

import { defineConfig } from "vitest/config"

// Prayer times must not depend on the device's time zone, so the tests run far from Indonesia.
process.env.TZ = "America/New_York"

export default defineConfig({
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
  test: { include: ["src/**/*.test.ts", "supabase/**/*.test.ts"] },
})
