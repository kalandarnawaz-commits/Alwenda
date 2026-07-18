import { readFile } from "node:fs/promises";
import path from "node:path";

function fail(message) {
  console.error(`[authorization-check] ${message}`);
  process.exitCode = 1;
}

const foundation = await readFile(path.resolve("supabase/migrations/202607150001_production_foundation.sql"), "utf8");
const lifecycle = await readFile(path.resolve("supabase/migrations/202607180001_business_lifecycle_audit.sql"), "utf8");
const evidence = await readFile(path.resolve("supabase/migrations/202607180002_business_claim_evidence_storage.sql"), "utf8");
const edgeFunction = await readFile(path.resolve("supabase/functions/alwen-chat/index.ts"), "utf8");

const checks = [
  {
    name: "private profiles owner-only",
    ok: /Users manage own private profile/.test(foundation) && /auth\.uid\(\) = user_id/.test(foundation)
  },
  {
    name: "claimants cannot approve claims",
    ok:
      /Users create own business claims/.test(foundation) &&
      /status = 'pending'/.test(foundation) &&
      /Admins review business claims/.test(foundation) &&
      /public\.is_trusted_admin\(\)/.test(foundation)
  },
  {
    name: "messages require conversation participant",
    ok: /Participants read messages/.test(foundation) && /Participants send own messages/.test(foundation) && /auth\.uid\(\) = sender_user_id/.test(foundation)
  },
  {
    name: "business protected lifecycle fields are admin-only",
    ok: /guard_business_protected_fields/.test(lifecycle) && /not public\.is_trusted_admin\(\)/.test(lifecycle)
  },
  {
    name: "reviewer records are not public",
    ok: /Admins append lifecycle events/.test(lifecycle) && /Admins review ambassador visits/.test(lifecycle)
  },
  {
    name: "claim evidence bucket is private",
    ok: /business-claim-evidence', 'business-claim-evidence', false/.test(evidence) && !/Public can view/.test(evidence)
  },
  {
    name: "claim evidence claimant/admin scoped",
    ok: /bc\.claimant_user_id = auth\.uid\(\)/.test(evidence) && /public\.is_trusted_admin\(\)/.test(evidence)
  },
  {
    name: "edge function requires authenticated Supabase user",
    ok: /supabase\.auth\.getUser\(\)/.test(edgeFunction) && /Authentication required\.", 401/.test(edgeFunction)
  },
  {
    name: "OpenAI key only in edge function env",
    ok: /Deno\.env\.get\("OPENAI_API_KEY"\)/.test(edgeFunction) && !/OPENAI_API_KEY/.test(await readFile(path.resolve("env.example.js"), "utf8"))
  }
];

for (const check of checks) {
  if (!check.ok) fail(check.name);
}

if (!process.exitCode) {
  console.log(`[authorization-check] ${checks.length} authorization boundaries validated.`);
}
