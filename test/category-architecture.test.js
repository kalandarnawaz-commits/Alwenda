import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_CONFIG,
  orderedCategoryIds,
  categoryConfigFor,
  classifyTextToCategory,
  normalizeOpportunityCategory
} from "../src/data/categoryConfig.js";
import { categories, professionalCategories } from "../src/data/mockData.js";
import { CITY_ENTITY_CATEGORIES } from "../src/services/dataImport/cityEntitySchema.js";

// Constrained by the DB check constraint on public.listings.category —
// see supabase/migrations/202607150001_production_foundation.sql.
const LISTING_DB_CATEGORIES = ["buy_sell", "rentals", "jobs", "local_services", "vehicles", "property", "businesses", "offers"];

const MARKETPLACE_CATEGORY_IDS = new Set(categories.map((c) => c.id));
const HIRE_CATEGORY_VALUES = new Set(professionalCategories.map((c) => c.value));
const CITY_ENTITY_CATEGORY_SET = new Set(CITY_ENTITY_CATEGORIES);
const LISTING_DB_CATEGORY_SET = new Set(LISTING_DB_CATEGORIES);

test("CATEGORY_CONFIG has an 'other' catch-all with no mapping requirements", () => {
  assert.ok(CATEGORY_CONFIG.other);
  assert.deepEqual(CATEGORY_CONFIG.other.keywords, []);
});

test("every CATEGORY_CONFIG entry has the required shape", () => {
  for (const [id, entry] of Object.entries(CATEGORY_CONFIG)) {
    assert.equal(typeof entry.icon, "string", `${id}.icon`);
    assert.equal(typeof entry.labelKey, "string", `${id}.labelKey`);
    assert.ok(Array.isArray(entry.keywords), `${id}.keywords`);
    assert.ok(Array.isArray(entry.legacyAliases), `${id}.legacyAliases`);
    assert.ok(Array.isArray(entry.opportunityCategories), `${id}.opportunityCategories`);
    assert.ok(Array.isArray(entry.hireCategoryValues), `${id}.hireCategoryValues`);
    assert.ok(entry.posting && typeof entry.posting === "object", `${id}.posting`);
    assert.ok(Array.isArray(entry.posting.requiredFields) && entry.posting.requiredFields.length > 0, `${id}.posting.requiredFields`);
  }
});

test("every marketplaceCategoryId maps to a real marketplace category", () => {
  for (const [id, entry] of Object.entries(CATEGORY_CONFIG)) {
    assert.ok(MARKETPLACE_CATEGORY_IDS.has(entry.marketplaceCategoryId), `${id}.marketplaceCategoryId "${entry.marketplaceCategoryId}" must be a real categories[].id`);
  }
});

test("every listingDbCategory is a real listings.category enum value", () => {
  for (const [id, entry] of Object.entries(CATEGORY_CONFIG)) {
    assert.ok(LISTING_DB_CATEGORY_SET.has(entry.listingDbCategory), `${id}.listingDbCategory "${entry.listingDbCategory}" must match the listings table's check constraint`);
  }
});

test("every hireCategoryValues entry is a real professionalCategories value", () => {
  for (const [id, entry] of Object.entries(CATEGORY_CONFIG)) {
    for (const value of entry.hireCategoryValues) {
      assert.ok(HIRE_CATEGORY_VALUES.has(value), `${id}.hireCategoryValues includes "${value}" which is not a real professionalCategories value`);
    }
  }
});

test("every non-null cityEntityCategory is a real CITY_ENTITY_CATEGORIES value", () => {
  for (const [id, entry] of Object.entries(CATEGORY_CONFIG)) {
    if (entry.cityEntityCategory == null) continue;
    assert.ok(CITY_ENTITY_CATEGORY_SET.has(entry.cityEntityCategory), `${id}.cityEntityCategory "${entry.cityEntityCategory}" must be a real CITY_ENTITY_CATEGORIES value`);
  }
});

test("orderedCategoryIds returns every CATEGORY_CONFIG key exactly once, and a fresh copy each call", () => {
  const ids = orderedCategoryIds();
  assert.deepEqual([...ids].sort(), Object.keys(CATEGORY_CONFIG).sort());
  const a = orderedCategoryIds();
  a.push("mutated");
  assert.ok(!orderedCategoryIds().includes("mutated"), "orderedCategoryIds must return a fresh array each call");
});

test("categoryConfigFor falls back to 'other' for an unknown id", () => {
  assert.equal(categoryConfigFor("not-a-real-category"), CATEGORY_CONFIG.other);
  assert.equal(categoryConfigFor("teaching"), CATEGORY_CONFIG.teaching);
});

test("classifyTextToCategory resolves the spec's own worked examples", () => {
  assert.equal(classifyTextToCategory("I can teach English."), "teaching");
  assert.equal(classifyTextToCategory("I need someone to walk my dog"), "petCare");
  assert.equal(classifyTextToCategory("I need airport pickup"), "transport");
  assert.equal(classifyTextToCategory("I can assemble IKEA furniture"), "homeRepairs");
});

test("classifyTextToCategory returns null for empty or unmatched text, never 'other'", () => {
  assert.equal(classifyTextToCategory(""), null);
  assert.equal(classifyTextToCategory("   "), null);
  assert.equal(classifyTextToCategory("xyzzy plugh qwerty"), null);
});

test("normalizeOpportunityCategory: preserves an explicit valid categoryId", () => {
  const record = { categoryId: "petCare", category: "Transport" };
  assert.equal(normalizeOpportunityCategory(record), "petCare");
});

test("normalizeOpportunityCategory: maps a legacy category string via classifyTextToCategory/legacyAliases", () => {
  assert.equal(normalizeOpportunityCategory({ category: "Tutoring" }), "teaching");
  assert.equal(normalizeOpportunityCategory({ category: "Pet care" }), "petCare");
});

test("normalizeOpportunityCategory: falls back to 'other' when nothing matches", () => {
  assert.equal(normalizeOpportunityCategory({ category: "completely-unrecognised-string" }), "other");
  assert.equal(normalizeOpportunityCategory({}), "other");
});

test("normalizeOpportunityCategory: never mutates the input record", () => {
  const record = Object.freeze({ category: "Tutoring" });
  assert.doesNotThrow(() => normalizeOpportunityCategory(record));
  assert.equal(normalizeOpportunityCategory(record), "teaching");
});

test("normalizeOpportunityCategory: an invalid persisted categoryId falls through to legacy classification, not a crash", () => {
  const record = { categoryId: "not-real", category: "Delivery" };
  assert.equal(normalizeOpportunityCategory(record), "delivery");
});
