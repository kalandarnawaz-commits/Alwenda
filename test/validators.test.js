import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidEmail, isValidPassword } from "../src/utils/validators.js";

test("isValidEmail accepts well-formed addresses", () => {
  assert.equal(isValidEmail("user@example.com"), true);
  assert.equal(isValidEmail("  user@example.com  "), true);
  assert.equal(isValidEmail("first.last+tag@sub.example.co.uk"), true);
});

test("isValidEmail rejects malformed addresses", () => {
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("missing@domain"), false);
  assert.equal(isValidEmail("@example.com"), false);
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail(undefined), false);
});

test("isValidPassword enforces an 8-character minimum", () => {
  assert.equal(isValidPassword("1234567"), false);
  assert.equal(isValidPassword("12345678"), true);
  assert.equal(isValidPassword(""), false);
  assert.equal(isValidPassword(null), false);
});
