import { test } from "node:test";
import assert from "node:assert/strict";

test("Vilnius area selector covers the full city, not only launch neighbourhoods", async () => {
  const { neighbourhoods } = await import("../src/data/mockData.js");

  assert.ok(neighbourhoods.length >= 30);
  for (const area of ["Žirmūnai", "Naujininkai", "Pilaitė", "Lazdynai", "Pašilaičiai", "Fabijoniškės", "Grigiškės"]) {
    assert.ok(neighbourhoods.includes(area), `${area} should be available in the city selector`);
  }
});
