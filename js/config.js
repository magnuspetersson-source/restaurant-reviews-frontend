// js/config.js
// Single source of truth for public+admin runtime config.
// - Reads from #app data-attributes (Squarespace-stable)
// - Merges with any pre-existing window.RR_CONFIG (admin/local overrides)
// - Optionally loads public runtime config from backend (/api/public-config)
// - Exposes window.RR_PUBLIC_CONFIG used by public UI

function normalizeBase(url) {
  return (typeof url === "string" ? url.trim() : "").replace(/\/+$/, "");
}

async function loadPublicConfig(apiBase) {
  const base = normalizeBase(apiBase);
  if (!base) return {};
  try {
    const res = await fetch(`${base}/api/public-config`, { credentials: "omit" });
    if (!res.ok) throw new Error(`public-config failed: HTTP ${res.status}`);
    const json = await res.json();
    return json && typeof json === "object" ? json : {};
  } catch (e) {
    console.warn("[RR] Could not load public config", e);
    return {};
  }
}

// Expose a ready promise that app.js can await (prevents race w/ map init)
window.RR_CONFIG_READY = (async function bootstrap() {
  const root = document.getElementById("app");

  // Ensure RR_CONFIG exists (don't overwrite if already present)
  window.RR_CONFIG = window.RR_CONFIG || {};
  const cfg = window.RR_CONFIG;

  // Read Squarespace-stable config from DOM attributes
  const apiBaseFromAttr = normalizeBase(root?.getAttribute("data-api-base") || "");
  const mapsKeyFromAttr = (root?.getAttribute("data-maps-key") || "").trim(); // legacy support if you ever use it again

  // Backward compat: if someone set backendBaseUrl, treat it as apiBase
  if (!cfg.apiBase && typeof cfg.backendBaseUrl === "string" && cfg.backendBaseUrl.trim()) {
    cfg.apiBase = normalizeBase(cfg.backendBaseUrl);
  }

  // Fill missing apiBase from DOM (only if not already set)
  if (!cfg.apiBase && apiBaseFromAttr) cfg.apiBase = apiBaseFromAttr;

  // Legacy/manual fallback: allow maps key from DOM only if you explicitly set it
  if (!cfg.googleMapsApiKey && mapsKeyFromAttr) cfg.googleMapsApiKey = mapsKeyFromAttr;

  // Defaults (safe)
  if (typeof cfg.homeLat !== "number") cfg.homeLat = 56.67526326918155;
  if (typeof cfg.homeLng !== "number") cfg.homeLng = 12.840977534456771;

  // --- Dynamic injection from backend (Vercel env) ---
  // If we don't already have a key, try fetching it from /api/public-config
  if (!cfg.googleMapsApiKey && cfg.apiBase) {
    const publicCfg = await loadPublicConfig(cfg.apiBase);

    if (publicCfg && typeof publicCfg.googleMapsApiKey === "string" && publicCfg.googleMapsApiKey.trim()) {
      cfg.googleMapsApiKey = publicCfg.googleMapsApiKey.trim();
    }
  }

  // Build public config used by frontend modules
  window.RR_PUBLIC_CONFIG = {
    apiBase: normalizeBase(cfg.apiBase || ""),

    googleMapsApiKey:
      typeof cfg.googleMapsApiKey === "string" && cfg.googleMapsApiKey.trim()
        ? cfg.googleMapsApiKey.trim()
        : "",

    mapDefault: { lat: 56.6745, lng: 12.8578, zoom: 13 },

    moderationCopy: {
      posted: "Tack! Din kommentar är skickad.",
      postedPending: "Tack! Din kommentar är skickad och väntar på granskning."
    }
  };

  return window.RR_PUBLIC_CONFIG;
})();