import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const manifestPath = fileURLToPath(new URL("../manifest.json", import.meta.url));

test("manifest.json parses as valid JSON", async () => {
  const text = await readFile(manifestPath, "utf8");
  assert.doesNotThrow(() => JSON.parse(text));
});

test("manifest.json has the required PWA installability fields", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(typeof manifest.name, "string");
  assert.equal(typeof manifest.short_name, "string");
  assert.equal(manifest.display, "standalone");
  assert.equal(typeof manifest.start_url, "string");
  assert.equal(typeof manifest.background_color, "string");
  assert.equal(typeof manifest.theme_color, "string");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
});

test("manifest.json declares both a 192x192 and a 512x512 icon", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes("192x192"));
  assert.ok(sizes.includes("512x512"));
});

test("manifest.json declares at least one maskable icon", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
});
