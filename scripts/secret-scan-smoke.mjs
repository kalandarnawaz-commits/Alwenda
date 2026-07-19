import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const secretPatterns = [
  { name: "OpenAI API key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "GitHub token", pattern: /\bghp_[A-Za-z0-9]{36,}\b/ },
  { name: "Supabase JWT-like token", pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ }
];

function scanText(text) {
  return secretPatterns.filter((entry) => entry.pattern.test(text)).map((entry) => entry.name);
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), "alwenda-secret-smoke-"));
const fixturePath = path.join(tempDir, "fake-secret.fixture");

try {
  await writeFile(fixturePath, "OPENAI_API_KEY=sk-test_fake_secret_for_scanner_validation_1234567890\n", "utf8");
  const matches = scanText(await readFile(fixturePath, "utf8"));
  if (!matches.includes("OpenAI API key")) {
    console.error("[secret-smoke] Failed to detect temporary fake OpenAI key fixture.");
    process.exitCode = 1;
  } else {
    console.log("[secret-smoke] Temporary fake fixture detected successfully.");
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
