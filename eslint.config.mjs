import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
    rules: {
      // Catch forgotten awaits — common in ingest/route handlers where a
      // fire-and-forget Promise loses errors silently.
      "@typescript-eslint/no-floating-promises": "warn",
      // Unused vars are a code smell; allow underscore-prefix as opt-out.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "test-results/**",
    "e2e/**",
    "backups/**",
    "scripts/archive/**",
    ".claude/**",
    "eslint.config.mjs",
    "*.config.ts",
    "*.config.mjs",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
