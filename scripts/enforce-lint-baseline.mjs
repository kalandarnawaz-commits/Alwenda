import { spawnSync } from "node:child_process";

// Calibrated to main's actual warning count as of this CI-infra branch (dead
// code cleanup lives in the compliance branch, out of scope here — lower
// this once that merges and removes the underlying warnings).
const WARNING_BASELINE = 26;

const result = spawnSync("npx", ["eslint", "src", "test", "--format", "json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

if (result.error) {
  console.error(`[lint-baseline] Failed to run ESLint: ${result.error.message}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout || "[]");
} catch (error) {
  console.error("[lint-baseline] ESLint did not return valid JSON.");
  console.error(result.stdout);
  console.error(result.stderr);
  process.exit(1);
}

const totals = report.reduce(
  (acc, file) => ({
    errors: acc.errors + file.errorCount,
    warnings: acc.warnings + file.warningCount
  }),
  { errors: 0, warnings: 0 }
);

if (totals.errors > 0) {
  console.error(`[lint-baseline] ESLint reported ${totals.errors} errors.`);
  process.exit(1);
}

if (totals.warnings > WARNING_BASELINE) {
  console.error(`[lint-baseline] ESLint warnings increased from ${WARNING_BASELINE} to ${totals.warnings}.`);
  process.exit(1);
}

console.log(`[lint-baseline] ${totals.errors} errors, ${totals.warnings}/${WARNING_BASELINE} warnings.`);
