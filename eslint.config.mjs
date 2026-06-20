import js from "@eslint/js";
import globals from "globals";
import noComments from "./tools/eslint-rules/no-comments.mjs";

const SOURCE_GLOBS = [
  "config/**/*.{js,mjs,cjs}",
  "constants/**/*.{js,mjs,cjs}",
  "controllers/**/*.{js,mjs,cjs}",
  "database/**/*.{js,mjs,cjs}",
  "middleware/**/*.{js,mjs,cjs}",
  "models/**/*.{js,mjs,cjs}",
  "realtime/**/*.{js,mjs,cjs}",
  "repositories/**/*.{js,mjs,cjs}",
  "routes/**/*.{js,mjs,cjs}",
  "services/**/*.{js,mjs,cjs}",
  "tasks/**/*.{js,mjs,cjs}",
  "utils/**/*.{js,mjs,cjs}",
  "views/**/*.{js,mjs,cjs}",
  "scripts/**/*.{js,mjs,cjs}",
  "tools/**/*.{js,mjs,cjs}",
  "index.js",
  "app.js",
  "server.js",
  "eslint.config.mjs",
];

export default [
  {
    ignores: ["node_modules/**", "coverage/**", ".husky/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: [
      "**/__tests__/**/*.{js,mjs,cjs}",
      "**/*.test.{js,mjs,cjs}",
      "**/*.spec.{js,mjs,cjs}",
    ],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
  {
    files: SOURCE_GLOBS,
    plugins: {
      local: { rules: { "no-comments": noComments } },
    },
    rules: {
      "local/no-comments": "error",
    },
  },
];
