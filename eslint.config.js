import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**"]
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      // Browser code, plus `process` alone (not the rest of globals.node)
      // — src/config.js defensively checks `typeof process !== "undefined"`
      // the same way it already checks `typeof window !== "undefined"`, so
      // the same source file works correctly under both the browser and
      // Node's test runner (APP_ENV can be set via process.env in tests).
      globals: { ...globals.browser, process: "readonly" }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
      eqeqeq: ["warn", "smart"],
      "no-var": "error"
    }
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error"
    }
  }
];
