// js/config.js
window.RR_CONFIG = {
  backendBaseUrl: "https://restaurant-reviews-backend-xi.vercel.app",

  // Admin / karta
  homeLat: 56.67526326918155,
  homeLng: 12.840977534456771,

};

(function () {
  const cfg = window.RR_CONFIG || {};
  window.RR_PUBLIC_CONFIG = {
    apiBase: (typeof cfg.apiBase === "string") ? cfg.apiBase.replace(/\/+$/, "") : "",
    googleMapsApiKey: (typeof cfg.googleMapsApiKey === "string") ? cfg.googleMapsApiKey : "",
    // Map defaults (Halmstad-ish if coords missing)
    mapDefault: { lat: 56.6745, lng: 12.8578, zoom: 13 },
    // Comment UX: if backend later modererar (pending), visa tack-text. Nu visar vi en neutral text.
    moderationCopy: {
      posted: "Tack! Din kommentar är skickad.",
      postedPending: "Tack! Din kommentar är skickad och väntar på granskning."
    }
  };
})();