import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDirectionsUrls, createCityEntity } from "../src/services/dataImport/cityEntitySchema.js";

test("buildDirectionsUrls uses coordinates when available", () => {
  const urls = buildDirectionsUrls({ lat: 54.6872, lng: 25.2797, name: "Test Cafe", address: "Test St 1" });
  assert.equal(urls.directionsGoogleUrl, "https://www.google.com/maps/search/?api=1&query=54.6872%2C25.2797");
  assert.equal(urls.directionsWazeUrl, "https://waze.com/ul?ll=54.6872%2C25.2797&navigate=yes");
  assert.equal(urls.directionsAppleUrl, "https://maps.apple.com/?q=Test%20Cafe&ll=54.6872,25.2797");
});

test("buildDirectionsUrls falls back to a name+address text query when coordinates are missing", () => {
  const urls = buildDirectionsUrls({ lat: null, lng: null, name: "Test Cafe", address: "Test St 1" });
  assert.equal(urls.directionsGoogleUrl, "https://www.google.com/maps/search/?api=1&query=Test%20Cafe%20Test%20St%201");
  assert.equal(urls.directionsWazeUrl, "https://waze.com/ul?q=Test%20Cafe%20Test%20St%201&navigate=yes");
  assert.equal(urls.directionsAppleUrl, "https://maps.apple.com/?q=Test%20Cafe%20Test%20St%201");
});

test("buildDirectionsUrls defaults the text query to Vilnius when address is missing", () => {
  const urls = buildDirectionsUrls({ name: "Test Cafe" });
  assert.match(urls.directionsGoogleUrl, /Test%20Cafe%20Vilnius/);
});

test("createCityEntity fills in every field with a safe default", () => {
  const entity = createCityEntity({ id: "osm:node/1", name: "Test Cafe", lat: 54.6872, lng: 25.2797 });
  assert.equal(entity.id, "osm:node/1");
  assert.equal(entity.email, null);
  assert.equal(entity.verificationStatus, "Unverified");
  assert.equal(entity.claimStatus, "Unclaimed");
  assert.ok(entity.directionsGoogleUrl.includes("54.6872"));
  assert.ok(entity.directionsAppleUrl.includes("54.6872"));
  assert.deepEqual(entity.tags, []);
});

test("createCityEntity preserves an explicitly provided email", () => {
  const entity = createCityEntity({ name: "Test Cafe", email: "hello@testcafe.lt" });
  assert.equal(entity.email, "hello@testcafe.lt");
});
