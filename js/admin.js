// js/admin.js
// Logik för adminsidan (skapa/uppdatera recensioner, bilduppladdning, osv.)

(function () {
  const cfg = window.RR_CONFIG || {};
  const baseUrl = cfg.backendBaseUrl;

  console.log("[admin] Backend base URL:", baseUrl);

  async function testConnection() {
    try {
      const res = await fetch(`${baseUrl}/api/reviews`);
      console.log("[admin] Testar backend, status:", res.status);
    } catch (err) {
      console.error("[admin] Backend-test fel:", err);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    testConnection();
    // TODO: koppla formulär, bilduppladdning, kartintegration, osv.
  });
})();
