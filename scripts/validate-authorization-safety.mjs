import { readFile } from "node:fs/promises";
import path from "node:path";

function fail(message) {
  console.error(`[authorization-check] ${message}`);
  process.exitCode = 1;
}

async function readIfExists(relativePath) {
  try {
    return await readFile(path.resolve(relativePath), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

const foundation = await readIfExists("supabase/migrations/202607150001_production_foundation.sql");
const lifecycle = await readIfExists("supabase/migrations/202607180001_business_lifecycle_audit.sql");
const evidence = await readIfExists("supabase/migrations/202607180002_business_claim_evidence_storage.sql");
const edgeFunction = await readIfExists("supabase/functions/alwen-chat/index.ts");
const envExample = await readIfExists("env.example.js");
const profileIdentity = await readIfExists("supabase/migrations/202607240001_profile_social_identity.sql");

const checks = [
  {
    name: "private profiles owner-only",
    source: foundation,
    ok: (foundation) => /Users manage own private profile/.test(foundation) && /auth\.uid\(\) = user_id/.test(foundation)
  },
  {
    name: "claimants cannot approve claims",
    source: foundation,
    ok: (foundation) =>
      /Users create own business claims/.test(foundation) &&
      /status = 'pending'/.test(foundation) &&
      /Admins review business claims/.test(foundation) &&
      /public\.is_trusted_admin\(\)/.test(foundation)
  },
  {
    name: "messages require conversation participant",
    source: foundation,
    ok: (foundation) => /Participants read messages/.test(foundation) && /Participants send own messages/.test(foundation) && /auth\.uid\(\) = sender_user_id/.test(foundation)
  },
  {
    name: "business protected lifecycle fields are admin-only",
    source: lifecycle,
    ok: (lifecycle) => /guard_business_protected_fields/.test(lifecycle) && /not public\.is_trusted_admin\(\)/.test(lifecycle)
  },
  {
    name: "reviewer records are not public",
    source: lifecycle,
    ok: (lifecycle) => /Admins append lifecycle events/.test(lifecycle) && /Admins review ambassador visits/.test(lifecycle)
  },
  {
    name: "claim evidence bucket is private",
    source: evidence,
    ok: (evidence) => /business-claim-evidence', 'business-claim-evidence', false/.test(evidence) && !/Public can view/.test(evidence)
  },
  {
    name: "claim evidence claimant/admin scoped",
    source: evidence,
    ok: (evidence) => /bc\.claimant_user_id = auth\.uid\(\)/.test(evidence) && /public\.is_trusted_admin\(\)/.test(evidence)
  },
  {
    name: "edge function requires authenticated Supabase user",
    source: edgeFunction,
    ok: (edgeFunction) => /supabase\.auth\.getUser\(\)/.test(edgeFunction) && /Authentication required\.", 401/.test(edgeFunction)
  },
  {
    name: "OpenAI key only in edge function env",
    source: edgeFunction,
    ok: (edgeFunction) => /Deno\.env\.get\("OPENAI_API_KEY"\)/.test(edgeFunction) && !/OPENAI_API_KEY/.test(envExample || "")
  },
  {
    name: "trust_scores has no client write policy — only the SECURITY DEFINER refresh function may write it",
    source: profileIdentity,
    ok: (profileIdentity) =>
      /alter table public\.trust_scores enable row level security/.test(profileIdentity) &&
      /create policy "Trust scores are readable" on public\.trust_scores for select using \(true\)/.test(profileIdentity) &&
      !/on public\.trust_scores for (insert|update|delete|all)/.test(profileIdentity) &&
      /create or replace function public\.refresh_trust_score/.test(profileIdentity) &&
      /security definer/.test(profileIdentity)
  },
  {
    name: "refresh_trust_score only writes its own computed result, never a caller-supplied score",
    source: profileIdentity,
    ok: (profileIdentity) => {
      const fnStart = profileIdentity.indexOf("create or replace function public.refresh_trust_score");
      const fnBody = profileIdentity.slice(fnStart, profileIdentity.indexOf("$$;", profileIdentity.indexOf("$$;", fnStart) + 3));
      return (
        /auth\.uid\(\) is distinct from p_user_id and not public\.is_trusted_admin\(\)/.test(fnBody) &&
        /v_result := public\.compute_trust_score\(p_user_id\)/.test(fnBody) &&
        !/p_score|score integer/.test(fnBody.replace("create or replace function public.refresh_trust_score(p_user_id uuid)", ""))
      );
    }
  },
  {
    name: "profile_follows prevents self-follow and only lets a user write relationships as themselves",
    source: profileIdentity,
    ok: (profileIdentity) =>
      /check \(follower_user_id <> followed_user_id\)/.test(profileIdentity) &&
      /create policy "Users create own follow relationships" on public\.profile_follows for insert with check \(auth\.uid\(\) = follower_user_id\)/.test(profileIdentity) &&
      /create policy "Users remove own follow relationships" on public\.profile_follows for delete using \(auth\.uid\(\) = follower_user_id\)/.test(profileIdentity)
  },
  {
    name: "handles are unique case-insensitively and reserved words are blocked",
    source: profileIdentity,
    ok: (profileIdentity) =>
      /create unique index if not exists public_profiles_handle_unique_idx[\s\S]{0,80}lower\(handle\)/.test(profileIdentity) &&
      /public_profiles_handle_not_reserved[\s\S]{0,80}is_reserved_handle/.test(profileIdentity)
  }
];

let skipped = 0;
for (const check of checks) {
  if (check.source === null) {
    skipped += 1;
    continue;
  }
  if (!check.ok(check.source)) fail(check.name);
}

if (!process.exitCode) {
  const ran = checks.length - skipped;
  console.log(`[authorization-check] ${ran} authorization boundaries validated${skipped ? ` (${skipped} skipped: source files not present on this branch)` : ""}.`);
}
