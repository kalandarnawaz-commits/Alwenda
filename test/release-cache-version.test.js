import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function assetVersions(markup) {
  return [...markup.matchAll(/[?&]v=([^"']+)/g)].map((match) => match[1]);
}

test("entrypoint assets share one cache-busting release version", async () => {
  const index = await readRepoFile("index.html");
  const authCallback = await readRepoFile("auth/callback/index.html");
  const serviceWorker = await readRepoFile("sw.js");

  const indexVersions = assetVersions(index);
  const authVersions = assetVersions(authCallback);
  const allVersions = [...indexVersions, ...authVersions];
  const uniqueVersions = new Set(allVersions);
  assert.equal(uniqueVersions.size, 1, `expected one release version, found: ${[...uniqueVersions].join(", ")}`);

  const [releaseVersion] = uniqueVersions;
  assert.ok(releaseVersion, "release version must be present on entry assets");
  assert.match(serviceWorker, new RegExp(`RELEASE_VERSION = "${releaseVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
});

test("clear-cache redirects to the latest generic build rather than stale feature markers", async () => {
  const clearCache = await readRepoFile("clear-cache.html");

  assert.match(clearCache, /cache-cleared-/);
  assert.doesNotMatch(clearCache, /live-opportunity-detail|elevenlabs-tts|alwen-2-0-3/);
});
