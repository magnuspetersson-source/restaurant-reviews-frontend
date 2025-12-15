// js/config.js
// Single source of truth for public+admin runtime config.
// - Reads from #app data-attributes (Squarespace-stable)
// - Merges with any pre-existing window.RR_CONFIG (admin/local overrides)
// - Exposes window.RR_PUBLIC_CONFIG used by public UI

(function () {
  const root = document.getElementById("app");

  // Ensure RR_CONFIG exists (don't overwrite if already present)
  window.RR_CONFIG = window.RR_CONFIG || {};
  const cfg = window.RR_CONFIG;

  // Read Squarespace-stable config from DOM attributes
  const apiBaseFromAttr =
    root && root.getAttribute("data-api-base")
      ? root.getAttribute("data-api-base").trim().replace(/\/+$/, "")
      : "";

  const mapsKeyFromAttr =
    root && root.getAttribute("data-maps-key")
      ? root.getAttribute("data-maps-key").trim()
      : "";

  // Backward compat: if someone set backendBaseUrl, treat it as apiBase
  // (Your current file uses backendBaseUrl.)  [oai_citation:2‡config.js](sediment://file_0000000007a8720a80d390ce7fdf5338)
  if (!cfg.apiBase && typeof cfg.backendBaseUrl === "string" && cfg.backendBaseUrl.trim()) {
    cfg.apiBase = cfg.backendBaseUrl.trim().replace(/\/+$/, "");
  }

  // Fill missing values from DOM (only if not already set)
  if (!cfg.apiBase && apiBaseFromAttr) cfg.apiBase = apiBaseFromAttr;
  if (!cfg.googleMapsApiKey && mapsKeyFromAttr) cfg.googleMapsApiKey = mapsKeyFromAttr;

  // Defaults (safe)
  if (typeof cfg.homeLat !== "number") cfg.homeLat = 56.67526326918155;
  if (typeof cfg.homeLng !== "number") cfg.homeLng = 12.840977534456771;

  // Public config used by public frontend
  window.RR_PUBLIC_CONFIG = {
    apiBase: (typeof cfg.apiBase === "string" && cfg.apiBase.trim())
      ? cfg.apiBase.replace(/\/+$/, "")
      : "",

    googleMapsApiKey: (typeof cfg.googleMapsApiKey === "string" && cfg.googleMapsApiKey.trim())
      ? cfg.googleMapsApiKey.trim()
      : "",

    mapDefault: { lat: 56.6745, lng: 12.8578, zoom: 13 },

    moderationCopy: {
      posted: "Tack! Din kommentar är skickad.",
      postedPending: "Tack! Din kommentar är skickad och väntar på granskning."
    }
  };
})();