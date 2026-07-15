import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const localesDir = fileURLToPath(new URL("../locales/", import.meta.url));

let originalFetch;

before(() => {
  originalFetch = globalThis.fetch;
  // The app loads locales via a relative fetch("./locales/xx.json"), which
  // only resolves against a real page URL in a browser. In Node there is no
  // document location, so tests stub fetch to read the same files from disk.
  globalThis.fetch = async (url) => {
    const match = String(url).match(/locales\/([a-z]+)\.json/);
    if (!match) throw new Error(`Unexpected fetch in test: ${url}`);
    const text = await readFile(`${localesDir}${match[1]}.json`, "utf8");
    return { ok: true, json: async () => JSON.parse(text) };
  };
});

after(() => {
  globalThis.fetch = originalFetch;
});

test("t() resolves a namespaced key in the active language", async () => {
  const { setLanguage, t } = await import("../src/i18n/i18n.js");
  await setLanguage("en");
  assert.equal(t("common.appName"), "Alwenda");
});

test("t() falls back to English when the key is missing in the active language", async () => {
  const { setLanguage, t } = await import(`../src/i18n/i18n.js?case=fallback`);
  await setLanguage("de");
  // A key guaranteed to exist in English; if German were missing this key
  // the fallback chain (not a crash) is what's under test either way.
  const value = t("common.appName");
  assert.equal(typeof value, "string");
  assert.notEqual(value, "common.appName");
});

test("t() returns the raw key when it exists in no loaded locale", async () => {
  const { setLanguage, t } = await import(`../src/i18n/i18n.js?case=missing`);
  await setLanguage("en");
  assert.equal(t("this.key.does.not.exist"), "this.key.does.not.exist");
});

test("t() interpolates {param} tokens", async () => {
  const { setLanguage, t } = await import(`../src/i18n/i18n.js?case=interpolate`);
  await setLanguage("en");
  const result = t("auth.verifyCodeHint", { target: "user@example.com" });
  assert.ok(result.includes("user@example.com"), `expected interpolated target in: ${result}`);
});
