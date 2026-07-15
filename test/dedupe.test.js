import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineDistanceMeters, annotateDuplicates, normalizeNameForMatch } from "../src/services/dataImport/dedupe.js";

test("haversineDistanceMeters returns ~0 for identical coordinates", () => {
  const distance = haversineDistanceMeters(54.6872, 25.2797, 54.6872, 25.2797);
  assert.ok(distance < 1);
});

test("haversineDistanceMeters returns Infinity when any coordinate is missing", () => {
  assert.equal(haversineDistanceMeters(null, 25.2797, 54.6872, 25.2797), Infinity);
  assert.equal(haversineDistanceMeters(54.6872, undefined, 54.6872, 25.2797), Infinity);
});

test("haversineDistanceMeters returns a realistic distance for two known Vilnius points", () => {
  // Vilnius Cathedral Square to Gediminas' Tower, roughly 350-450m apart.
  const distance = haversineDistanceMeters(54.6862, 25.2867, 54.6858, 25.2919);
  assert.ok(distance > 200 && distance < 600, `expected 200-600m, got ${distance}`);
});

test("normalizeNameForMatch lowercases and strips punctuation/diacritics", () => {
  assert.equal(normalizeNameForMatch("Café Zoja!"), "cafe zoja");
  assert.equal(normalizeNameForMatch(""), "");
  assert.equal(normalizeNameForMatch(null), "");
});

test("annotateDuplicates flags a candidate that is close and name-similar to an existing entity", () => {
  const existing = [{ id: "existing-1", name: "City Pharmacy", lat: 54.6872, lng: 25.2797 }];
  const candidates = [{ name: "City Pharmacy", lat: 54.68721, lng: 25.27971 }];
  const [result] = annotateDuplicates(candidates, existing);
  assert.equal(result.isDuplicate, true);
  assert.equal(result.duplicateOf, "existing-1");
});

test("annotateDuplicates does not flag a candidate that is close but has a different name", () => {
  const existing = [{ id: "existing-1", name: "City Pharmacy", lat: 54.6872, lng: 25.2797 }];
  const candidates = [{ name: "Corner Bakery", lat: 54.68721, lng: 25.27971 }];
  const [result] = annotateDuplicates(candidates, existing);
  assert.equal(result.isDuplicate, false);
  assert.equal(result.duplicateOf, null);
});

test("annotateDuplicates does not flag a candidate with the same name far away", () => {
  const existing = [{ id: "existing-1", name: "City Pharmacy", lat: 54.6872, lng: 25.2797 }];
  const candidates = [{ name: "City Pharmacy", lat: 55.0, lng: 26.0 }];
  const [result] = annotateDuplicates(candidates, existing);
  assert.equal(result.isDuplicate, false);
});
