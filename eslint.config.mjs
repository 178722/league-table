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
    // Electronビルド成果物（electron/配下のTypeScriptソースをtscでコンパイルしたもの）
    "dist-electron/**",
    "release/**",
    ".electron-deps/**",
  ]),
]);

export default eslintConfig;
