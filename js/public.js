// js/public.js
// Logik för publika visningssidan (karta + recensioner)

(function () {
  const cfg = window.RR_CONFIG || {};
  const baseUrl = cfg.backendBaseUrl;

  console.log("[public] Backend base URL:", baseUrl);

  // Exempel: hämta alla reviews vid start
  async function loadReviews() {
    try {
      const res = await fetch(`${baseUrl}/api/reviews`);
      if (!res.ok) throw new Error("Kunde inte hämta recensioner");
      const data = await res.json();
      console.log("[public] Reviews:", data);
      // TODO: rendera in i DOM (#reviews)
    } catch (err) {
      console.error("[public] loadReviews error:", err);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadReviews();
    // TODO: initiera karta, markers osv.
  });
})();
