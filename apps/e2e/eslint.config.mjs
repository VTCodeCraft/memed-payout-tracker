import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["test-results/**", "playwright-report/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["start-api.mjs"], languageOptions: { globals: { process: "readonly", URL: "readonly" } } },
);
