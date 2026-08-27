import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Unit tests only, for now: pure logic in src/lib that needs no database
// and no Supabase project (permissions, availability math, formatting).
// RLS/tenant-isolation tests need a real Postgres instance (`supabase
// start`, which needs Docker) and aren't covered here yet — see the note
// in docs/RLS.md.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
