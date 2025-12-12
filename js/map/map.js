(function () {
  const CFG = window.RR_PUBLIC_CONFIG;

  let map = null;

  function loadGoogleMaps() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) return resolve();
      const key = CFG.googleMapsApiKey;
      if (!key) return reject(new Error("Saknar googleMapsApiKey i window.RR_CONFIG"));

      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Kunde inte ladda Google Maps JS"));
      document.head.appendChild(s);
    });
  }

  async function initMap(el) {
    await loadGoogleMaps();
    map = new google.maps.Map(el, {
      center: { lat: CFG.mapDefault.lat, lng: CFG.mapDefault.lng },
      zoom: CFG.mapDefault.zoom,
      mapId: undefined,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false
    });
    return map;
  }

  function getMap() { return map; }

  window.RR_MAP = { initMap, getMap };
})();
