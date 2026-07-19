import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const workflowsDir = path.resolve(".github/workflows");
const requiredTopLevelKeys = ["name:", "on:", "permissions:", "concurrency:", "jobs:"];

function fail(message) {
  console.error(`[workflow-check] ${message}`);
  process.exitCode = 1;
}

const files = (await readdir(workflowsDir)).filter((file) => /\.ya?ml$/.test(file)).sort();
if (!files.length) fail("No workflow files found.");

for (const file of files) {
  const source = await readFile(path.join(workflowsDir, file), "utf8");
  if (/\t/.test(source)) fail(`${file} contains tab indentation.`);
  for (const key of requiredTopLevelKeys) {
    if (!source.includes(`\n${key}`) && !source.startsWith(key)) fail(`${file} missing top-level ${key}`);
  }
  if (/pull_request_target/.test(source)) fail(`${file} must not use pull_request_target.`);
  if (/SUPABASE_ACCESS_TOKEN/.test(source) && !/workflow_dispatch/.test(source)) {
    fail(`${file} references deployment secrets outside a manual workflow.`);
  }
}

if (!process.exitCode) {
  console.log(`[workflow-check] ${files.length} workflow files validated.`);
}
