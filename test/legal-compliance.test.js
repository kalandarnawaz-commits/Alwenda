import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const policy = await readFile(new URL("../src/legal/ALWENDA_LEGAL_POLICIES_EN.md", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/202607180003_legal_compliance.sql", import.meta.url), "utf8");
const alwenFunction = await readFile(new URL("../supabase/functions/alwen-chat/index.ts", import.meta.url), "utf8");

test("approved legal source contains all four public policy sections unchanged", () => {
  for (const heading of ["# 1. Terms and Conditions", "# 2. Privacy Policy", "# 3. Cookie Policy", "# 4. Public Safety Notice"]) assert.match(policy, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(policy, /\[LEGAL NAME\]/);
  assert.match(policy, /\[DATE\]/);
});

test("public legal paths and persistent footer controls are wired", () => {
  for (const path of ["/terms", "/privacy", "/cookies", "/safety"]) assert.match(main, new RegExp(`"${path}"`));
  for (const label of ["Terms and Conditions", "Privacy Policy", "Cookie Policy", "Report illegal content", "Cookie settings"]) assert.ok(main.includes(label));
});

test("registration consent is mandatory and marketing is separate", () => {
  assert.match(main, /if \(!draft\.agreeTerms\)/);
  assert.match(main, /I have read and agree to the Alwenda/);
  assert.match(main, /register-marketing/);
  assert.match(main, /marketingConsent: false/);
});

test("optional analytics are gated by explicit cookie consent", () => {
  assert.match(main, /cookieConsent\?\.analytics !== true\) return/);
  assert.match(main, /Reject optional cookies/);
  assert.match(main, /Accept optional cookies/);
});

test("legal acceptance, moderation reports and privacy requests are reviewable records", () => {
  assert.match(migration, /create table if not exists public\.legal_acceptances/);
  assert.match(migration, /create table if not exists public\.legal_reports/);
  assert.match(migration, /create table if not exists public\.privacy_requests/);
  assert.match(migration, /enable row level security/g);
});

test("every listing creation path requires an offeror status", () => {
  assert.match(main, /listing-offeror-status/);
  assert.match(main, /if \(!draft\.offerorStatus\)/);
  assert.match(alwenFunction, /required: \["title", "description", "category", "offerorStatus"\]/);
  assert.match(alwenFunction, /offerorStatus/);
});
