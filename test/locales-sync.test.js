import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const localesDir = fileURLToPath(new URL("../locales/", import.meta.url));

function flattenKeys(obj, prefix = "") {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

async function loadKeys(lang) {
  const text = await readFile(`${localesDir}${lang}.json`, "utf8");
  return new Set(flattenKeys(JSON.parse(text)));
}

test("lt.json has exactly the same keys as en.json", async () => {
  const [en, lt] = await Promise.all([loadKeys("en"), loadKeys("lt")]);
  const missing = [...en].filter((key) => !lt.has(key));
  const extra = [...lt].filter((key) => !en.has(key));
  assert.deepEqual(missing, [], `lt.json is missing keys: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `lt.json has extra keys not in en.json: ${extra.join(", ")}`);
});

test("de.json has exactly the same keys as en.json", async () => {
  const [en, de] = await Promise.all([loadKeys("en"), loadKeys("de")]);
  const missing = [...en].filter((key) => !de.has(key));
  const extra = [...de].filter((key) => !en.has(key));
  assert.deepEqual(missing, [], `de.json is missing keys: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `de.json has extra keys not in en.json: ${extra.join(", ")}`);
});

test("every locale file is valid JSON with no empty string values", async () => {
  for (const lang of ["en", "lt", "de"]) {
    const keys = await loadKeys(lang);
    assert.ok(keys.size > 0, `${lang}.json should not be empty`);
  }
});
