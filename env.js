window.__ALWENDA_ENV__ = {
  SUPABASE_URL: "https://syfahecoodziijlsasum.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_p9To0VI-ZUwODmYThkKTIQ_bAjN6uT_"
};

(() => {
  const CURRENT_APP_VERSION = "marketplace-trending-detail-1";
  window.addEventListener("load", () => {
    const scripts = Array.from(document.scripts);
    const hasCurrentApp = scripts.some((script) => script.src.includes(`src/main.js?v=${CURRENT_APP_VERSION}`));
    const hasOldApp = scripts.some((script) => /src\/main\.js\?v=(phase2-ui|legal-compliance)/.test(script.src));
    if (hasCurrentApp || !hasOldApp) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = `./src/main.js?v=${CURRENT_APP_VERSION}`;
    document.body.append(script);
  });
})();
