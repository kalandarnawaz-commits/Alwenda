/**
 * Local environment config for Alwenda — copy this file to `env.js` (same
 * folder, next to index.html) and fill in real values from your Supabase
 * project (Project Settings → API) to enable real authentication.
 *
 * This is a static, zero-build app with no server and no bundler, so there
 * is no `process.env` at runtime — `env.js` is loaded as a plain <script>
 * before main.js and sets a global that src/config.js reads safely.
 *
 * env.js itself should never be committed — keep real keys out of git.
 * The Supabase publishable/anon key is designed to be exposed client-side
 * (it's the public half of the pair; access control comes from Row Level
 * Security policies configured in your Supabase project, not from keeping
 * this value secret), so this pattern is correct for a static SPA, not a
 * shortcut.
 *
 * Leave any value as null (or delete env.js entirely) to leave that
 * provider disabled — the app will show a clear "not configured" message
 * instead of faking a signed-in user.
 */
window.__ALWENDA_ENV__ = {
  SUPABASE_URL: null, // e.g. "https://xxxxxxxxxxxx.supabase.co"
  SUPABASE_PUBLISHABLE_KEY: null, // the publishable/anon key from Project Settings → API
  APP_ENV: "development", // "development", "staging", "production", or "test"
  APP_RELEASE_VERSION: "local-dev",
  PUBLIC_FEATURE_FLAGS: {
    googleOAuth: true,
    emailMagicLink: true
  }
};
