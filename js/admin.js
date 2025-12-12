// js/admin.js
// Admin – grund (backend-test + dynamisk Google Maps-loader)

(function () {
  const cfg = window.RR_CONFIG || {};
  const baseUrl = cfg.backendBaseUrl;
  const apiKey = cfg.googleMapsApiKey;

  const root = document.getElementById("restaurant-reviews-admin");

  function showMessage(html) {
    if (!root) return;
    root.innerHTML = html;
  }

  function loadGoogleMaps({ apiKey, callbackName }) {
    // Om Google redan finns (t.ex. om en annan del laddat Maps på sidan)
    if (window.google && window.google.maps) {
      if (typeof window[callbackName] === "function") window[callbackName]();
      return;
    }

    // Undvik att ladda flera gånger
    if (document.querySelector('script[data-rr-google-maps="1"]')) return;

    const script = document.createElement("script");
    script.setAttribute("data-rr-google-maps", "1");
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${encodeURIComponent(apiKey)}` +
      `&libraries=places` +
      `&callback=${encodeURIComponent(callbackName)}`;

    script.onerror = () => {
      console.error("[admin] Kunde inte ladda Google Maps script.");
      showMessage("<p>Kunde inte ladda Google Maps. Kontrollera API-nyckeln.</p>");
    };

    document.head.appendChild(script);
  }

  async function testConnection() {
    if (!baseUrl) {
      console.error("[admin] Saknar RR_CONFIG.backendBaseUrl");
      showMessage("<p>Saknar backendBaseUrl i RR_CONFIG.</p>");
      return;
    }

    try {
      const res = await fetch(`${baseUrl}/api/reviews`);
      console.log("[admin] Testar backend, status:", res.status);

      if (!res.ok) {
        showMessage(`<p>Backend svarade med status ${res.status}.</p>`);
        return;
      }

      const data = await res.json();
      showMessage(
        `<h1>Admin (test)</h1>
         <p>Backend OK. Antal reviews: <strong>${Array.isArray(data) ? data.length : 0}</strong></p>
         <div id="admin-map" style="width:100%; height:360px; border-radius:12px; overflow:hidden;"></div>`
      );

      // Om Maps redan laddats kan vi initiera direkt
      if (window.google && window.google.maps) {
        initMap();
      }
    } catch (err) {
      console.error("[admin] Backend-test fel:", err);
      showMessage("<p>Kunde inte nå backend.</p>");
    }
  }

  function initMap() {
    const homeLat = Number(cfg.homeLat);
    const homeLng = Number(cfg.homeLng);

    if (!Number.isFinite(homeLat) || !Number.isFinite(homeLng)) {
      console.warn("[admin] Saknar eller ogiltiga homeLat/homeLng i RR_CONFIG");
      return;
    }

    const el = document.getElementById("admin-map");
    if (!el) return;

    const map = new google.maps.Map(el, {
      center: { lat: homeLat, lng: homeLng },
      zoom: 13,
      mapTypeControl: false,
      fullscreenControl: false,
    });

    new google.maps.Marker({
      position: { lat: homeLat, lng: homeLng },
      map,
      title: "Home",
    });
  }

  // Google Maps callback (måste ligga på window)
  window.initRestaurantReviewsAdmin = function () {
    console.log("[admin] Google Maps loaded");
    initMap();
  };

  document.addEventListener("DOMContentLoaded", () => {
    testConnection();

    if (!apiKey) {
      console.warn("[admin] Saknar RR_CONFIG.googleMapsApiKey (kartdelen kommer ej laddas).");
      return;
    }

    loadGoogleMaps({ apiKey, callbackName: "initRestaurantReviewsAdmin" });
  });
})();