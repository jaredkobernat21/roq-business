import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Supabase Edge Functions run on Deno, a separate runtime from this
    // Next.js app — `Deno` globals and `jsr:`/`https:` specifiers are valid
    // there but not something this project's linter/tsconfig understands.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
