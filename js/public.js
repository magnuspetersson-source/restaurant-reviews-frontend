// js/public.js
// Public visningssida – renderar hela UI:t + laddar Maps dynamiskt

;(function () {
  const cfg = window.RR_CONFIG || {};
  const BACKEND_BASE_URL = cfg.backendBaseUrl;
  const HOME_LAT = Number(cfg.homeLat);
  const HOME_LNG = Number(cfg.homeLng);

  if (!BACKEND_BASE_URL) console.error("[public] Missing RR_CONFIG.backendBaseUrl");

  const root = document.getElementById("restaurant-reviews-public");
  if (!root) {
    console.error("[public] Missing #restaurant-reviews-public in DOM");
    return;
  }

  // Rendera hela markupen en gång (så Squarespace bara behöver root-diven)
  function renderShellOnce() {
    if (document.getElementById("rrp-map")) return;
  
    root.innerHTML = `
      <div class="rrp-header">
        <h2>Recenserade restauranger</h2>
        <p>Klicka på en pin eller en restaurang för att se detaljer.</p>
      </div>
  
      <div class="rrp-container">
        <div id="rrp-map"></div>
  
        <div class="rrp-side">
          <div class="rrp-filters">
            <div class="rrp-filter-group">
              <label for="rrp-filter-search">Sök</label>
              <input id="rrp-filter-search" type="text" placeholder="Sök..." />
            </div>
  
            <div class="rrp-filter-group">
              <label for="rrp-filter-type">Typ</label>
              <select id="rrp-filter-type">
                <option value="">Alla</option>
              </select>
            </div>
  
            <div class="rrp-filter-group">
              <label for="rrp-filter-cost">Kostnad</label>
              <select id="rrp-filter-cost">
                <option value="">Alla</option>
                <option value="1">$</option>
                <option value="2">$$</option>
                <option value="3">$$$</option>
                <option value="4">$$$$</option>
                <option value="5">$$$$$</option>
              </select>
            </div>
  
            <div class="rrp-filter-group">
              <label for="rrp-filter-min-rating">Min betyg</label>
              <select id="rrp-filter-min-rating">
                <option value="">Alla</option>
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
            </div>
  
            <div class="rrp-filter-group">
              <label for="rrp-sort">Sortera</label>
              <select id="rrp-sort">
                <option value="newest">Nyast</option>
                <option value="rating">Betyg</option>
                <option value="distance">Avstånd</option>
                <option value="name">Namn</option>
              </select>
            </div>
          </div>
  
          <div class="rrp-list-wrapper">
            <div id="rrp-list"></div>
          </div>
        </div>
      </div>
  
      <!-- Overlay (gamla strukturen/klasserna) -->
      <div id="rrp-overlay" class="rrp-overlay" style="display:none;">
        <div class="rrp-overlay-inner">
          <button type="button" class="rrp-overlay-close" id="rrp-overlay-close">×</button>
  
          <div class="rrp-overlay-grid">
            <div>
              <div class="rrp-overlay-title-row">
                <h3 id="rrp-overlay-title"></h3>
                <div id="rrp-overlay-rating"></div>
              </div>
  
              <div id="rrp-overlay-meta" class="rrp-overlay-meta"></div>
              <div id="rrp-overlay-distance" class="rrp-overlay-meta"></div>
              <div id="rrp-overlay-comment" class="rrp-overlay-comment"></div>
  
              <div class="rrp-comments">
                <h4>Kommentarer</h4>
                <div id="rrp-comments-list" class="rrp-comments-list"></div>
  
                <form id="rrp-comment-form">
                  <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.3rem;">
                    <input id="rrp-comment-name" type="text" placeholder="Namn*" required />
                    <input id="rrp-comment-email" type="email" placeholder="E-post (valfritt)" />
                  </div>
                  <textarea id="rrp-comment-text" placeholder="Skriv din kommentar." required></textarea>
                  <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.35rem;">
                    <button type="submit" id="rrp-comment-submit">Skicka kommentar</button>
                    <span id="rrp-comment-status" class="rrp-muted"></span>
                  </div>
                </form>
              </div>
            </div>
  
            <div>
              <div id="rrp-overlay-images" class="rrp-overlay-images"></div>
            </div>
          </div>
  
          <div class="rrp-overlay-footer">
            <div id="rrp-overlay-date" class="rrp-overlay-meta"></div>
            <a id="rrp-overlay-link" class="rrp-overlay-link" href="#" target="_blank" rel="noopener">
              Öppna i Google Maps
            </a>
          </div>
        </div>
      </div>
  
      <!-- Galleri-overlay (gamla ID:n!) -->
      <div id="rrp-gallery-overlay" class="rrp-overlay" style="display:none;">
        <div class="rrp-overlay-inner rrp-gallery-inner">
          <button type="button" class="rrp-overlay-close" id="rrp-gallery-close">×</button>
          <div class="rrp-gallery-content">
            <button type="button" class="rrp-gallery-nav-btn" id="rrp-gallery-prev">&#8249;</button>
            <div class="rrp-gallery-img-wrapper">
              <img id="rrp-gallery-img" src="" alt="Galleri-bild" />
            </div>
            <button type="button" class="rrp-gallery-nav-btn" id="rrp-gallery-next">&#8250;</button>
          </div>
          <div id="rrp-gallery-counter" class="rrp-gallery-counter"></div>
        </div>
      </div>
    `.trim();
  }

  // Google Maps loader (dynamisk)
  function loadGoogleMaps({ apiKey, callbackName }) {
    if (window.google && window.google.maps) {
      if (typeof window[callbackName] === "function") window[callbackName]();
      return;
    }
    if (document.querySelector('script[data-rr-google-maps="1"]')) return;

    const script = document.createElement("script");
    script.setAttribute("data-rr-google-maps", "1");
    script.async = true;
    script.defer = true;
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${encodeURIComponent(apiKey)}` +
      `&loading=async` +
      `&callback=${encodeURIComponent(callbackName)}`;

    script.onerror = () => console.error("[public] Failed to load Google Maps");
    document.head.appendChild(script);
  }

  // ======= DIN BEFINTLIGA LOGIK (från din fil), med ändrad init-struktur =======
  ;(function () {
    const ICON_REVIEWED = "http://maps.google.com/mapfiles/ms/icons/red-dot.png";

    let map = null;
    let infoWindow = null;

    let allReviews = [];
    let filteredReviews = [];

    let markers = [];
    let markerById = {};
    let selectedMarker = null;

    let overlayEl, overlayTitleEl, overlayMetaEl, overlayImagesEl, overlayCommentEl, overlayLinkEl;
    let commentsListEl, commentFormEl, commentStatusEl;
    let overlayOpen = false;
    let currentOverlayReviewId = null;

    let galleryOverlayEl, galleryImageEl, galleryCounterEl;
    let galleryPrevBtn, galleryNextBtn;
    let galleryImages = [];
    let galleryIndex = 0;

    function apiGet(path) {
      return fetch(BACKEND_BASE_URL + path).then((r) => {
        if (!r.ok) throw new Error("GET " + path + " failed: " + r.status);
        return r.json();
      });
    }

    function apiPost(path, body) {
      return fetch(BACKEND_BASE_URL + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error("POST " + path + " failed: " + r.status);
        return r.json();
      });
    }

    function clearMarkers() {
      markers.forEach((m) => m.setMap(null));
      markers = [];
      markerById = {};
      selectedMarker = null;
    }

    function setSelectedMarker(marker) {
      if (selectedMarker && selectedMarker !== marker) {
        try {
          if (selectedMarker._baseIcon) selectedMarker.setIcon(selectedMarker._baseIcon);
        } catch (e) {}
      }
      selectedMarker = marker || null;
      // (Valfritt: förstora marker här om du vill i public också)
    }

    function renderMarkers() {
      if (!map) return;
      clearMarkers();

      filteredReviews.forEach((r) => {
        if (r.restaurant_lat == null && r.restaurant_lng == null) return;

        const baseIcon = ICON_REVIEWED;
        const marker = new google.maps.Marker({
          map,
          position: { lat: r.restaurant_lat, lng: r.restaurant_lng },
          title: r.place_name,
          icon: baseIcon,
        });
        marker._baseIcon = baseIcon;

        markerById[r.id] = marker;
        markers.push(marker);

        marker.addListener("click", () => {
          openOverlay(r.id);
          setSelectedMarker(marker);
        });
      });
    }

    function populateTypeFilterOptions() {
      const el = document.getElementById("rrp-filter-type");
      if (!el) return;

      const types = new Set();
      allReviews.forEach((r) => {
        if (r.restaurant_type) types.add(r.restaurant_type);
      });

      const current = el.value || "";
      el.innerHTML = `<option value="">Alla</option>`;
      Array.from(types)
        .sort((a, b) => a.localeCompare(b, "sv-SE"))
        .forEach((t) => {
          const opt = document.createElement("option");
          opt.value = t;
          opt.textContent = t;
          el.appendChild(opt);
        });
      el.value = current;
    }

    function getFilters() {
      const q = (document.getElementById("rrp-filter-search")?.value || "").trim().toLowerCase();
      const type = document.getElementById("rrp-filter-type")?.value || "";
      const cost = document.getElementById("rrp-filter-cost")?.value || "";
      const minRating = document.getElementById("rrp-filter-min-rating")?.value || "";
      const sort = document.getElementById("rrp-sort")?.value || "newest";
      return { q, type, cost, minRating, sort };
    }

    function applyFiltersAndSort() {
      const { q, type, cost, minRating, sort } = getFilters();

      filteredReviews = allReviews.filter((r) => {
        if (type && (r.restaurant_type || "") !== type) return false;
        if (cost && String(r.cost_level || "") !== cost) return false;
        if (minRating && Number(r.rating || 0) < Number(minRating)) return false;

        if (q) {
          const hay = [
            r.place_name,
            r.restaurant_type,
            r.comment,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);
      const byRating = (a, b) => (b.rating || 0) - (a.rating || 0);
      const byDistance = (a, b) => (a.home_distance_km ?? 999999) - (b.home_distance_km ?? 999999);
      const byName = (a, b) => (a.place_name || "").localeCompare(b.place_name || "", "sv-SE");

      if (sort === "rating") filteredReviews.sort(byRating);
      else if (sort === "distance") filteredReviews.sort(byDistance);
      else if (sort === "name") filteredReviews.sort(byName);
      else filteredReviews.sort(byNewest);
    }

    function renderList() {
      const listEl = document.getElementById("rrp-list");
      if (!listEl) return;

      if (!filteredReviews.length) {
        listEl.innerHTML = `<p class="rrp-muted">Inga träffar.</p>`;
        return;
      }

      const wrap = document.createElement("div");
      wrap.className = "rrp-list";

      filteredReviews.forEach((r) => {
        const item = document.createElement("div");
        item.className = "rrp-item";
        item.dataset.id = r.id;

        const title = document.createElement("div");
        title.className = "rrp-item-title";
        title.textContent = r.place_name || "Okänd restaurang";

        const meta = document.createElement("div");
        meta.className = "rrp-item-meta";
        const parts = [];
        if (r.rating) parts.push(`${r.rating}/5`);
        if (r.restaurant_type) parts.push(r.restaurant_type);
        if (r.home_distance_km != null) parts.push(`${Number(r.home_distance_km).toFixed(1)} km`);
        meta.textContent = parts.join(" • ");

        item.appendChild(title);
        item.appendChild(meta);

        item.addEventListener("click", () => {
          openOverlay(r.id);
          focusOnRestaurant(r.id);
        });

        wrap.appendChild(item);
      });

      listEl.innerHTML = "";
      listEl.appendChild(wrap);
    }

    function focusOnRestaurant(id) {
      const r = filteredReviews.find((x) => x.id === id);
      if (!r) return;

      const marker = markerById[id];
      if (marker && map) {
        map.panTo(marker.getPosition());
        map.setZoom(15);
        setSelectedMarker(marker);
      }
    }

    async function loadReviews() {
      const listEl = document.getElementById("rrp-list");
      listEl.innerHTML = '<p class="rrp-muted">Hämtar restauranger...</p>';
      try {
        const data = await apiGet("/api/reviews");
        allReviews = data || [];
        populateTypeFilterOptions();

        applyFiltersAndSort();
        renderList();
        renderMarkers();
      } catch (err) {
        console.error("loadReviews error:", err);
        listEl.innerHTML = '<p class="rrp-muted" style="color:#b00020;">Kunde inte hämta recensioner.</p>';
      }
    }

    function attachFilterEvents() {
      const ids = ["rrp-filter-search", "rrp-filter-type", "rrp-filter-cost", "rrp-filter-min-rating", "rrp-sort"];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", () => {
          applyFiltersAndSort();
          renderList();
          renderMarkers();
        });
        el.addEventListener("change", () => {
          applyFiltersAndSort();
          renderList();
          renderMarkers();
        });
      });
    }

    function initOverlay() {
      overlayEl = document.getElementById("rrp-overlay");
      overlayTitleEl = document.getElementById("rrp-overlay-title");
      overlayMetaEl = document.getElementById("rrp-overlay-meta");
      overlayImagesEl = document.getElementById("rrp-overlay-images");
      overlayCommentEl = document.getElementById("rrp-overlay-comment");
      overlayLinkEl = document.getElementById("rrp-overlay-link");
      commentsListEl = document.getElementById("rrp-comments-list");
      commentFormEl = document.getElementById("rrp-comment-form");
      commentStatusEl = document.getElementById("rrp-comment-status");

      const closeBtn = document.getElementById("rrp-overlay-close");
      closeBtn?.addEventListener("click", closeOverlay);

      overlayEl?.addEventListener("click", (e) => {
        if (e.target?.dataset?.close === "1") closeOverlay();
      });

      commentFormEl?.addEventListener("submit", onCommentSubmit);
    }

    function initGalleryOverlay() {
      galleryOverlayEl = document.getElementById("rrp-gallery-overlay");
      galleryImageEl = document.getElementById("rrp-gallery-image");
      galleryCounterEl = document.getElementById("rrp-gallery-counter");
      galleryPrevBtn = document.getElementById("rrp-gallery-prev");
      galleryNextBtn = document.getElementById("rrp-gallery-next");

      document.getElementById("rrp-gallery-close")?.addEventListener("click", closeGallery);

      galleryOverlayEl?.addEventListener("click", (e) => {
        if (e.target?.dataset?.close === "1") closeGallery();
      });

      galleryPrevBtn?.addEventListener("click", () => showGalleryIndex(galleryIndex - 1));
      galleryNextBtn?.addEventListener("click", () => showGalleryIndex(galleryIndex + 1));
    }

    // Initiera allt som inte kräver Google Maps (så GitHub Pages kan testas utan maps-key)
    function initPublicUi() {
      attachFilterEvents();
      initOverlay();
      initGalleryOverlay();
      loadReviews();
    }

    function openGallery(images, startIndex) {
      galleryImages = images || [];
      galleryIndex = Math.max(0, Math.min(startIndex || 0, galleryImages.length - 1));
      showGalleryIndex(galleryIndex);
      galleryOverlayEl?.setAttribute("aria-hidden", "false");
    }

    function showGalleryIndex(i) {
      if (!galleryImages.length) return;
      galleryIndex = (i + galleryImages.length) % galleryImages.length;
      if (galleryImageEl) galleryImageEl.src = galleryImages[galleryIndex];
      if (galleryCounterEl) galleryCounterEl.textContent = `${galleryIndex + 1}/${galleryImages.length}`;
    }

    function closeGallery() {
      galleryOverlayEl?.setAttribute("aria-hidden", "true");
      galleryImages = [];
      galleryIndex = 0;
    }

    function openOverlay(id) {
      const r = allReviews.find((x) => x.id === id);
      if (!r) return;

      currentOverlayReviewId = id;

      overlayTitleEl.textContent = r.place_name || "Okänd restaurang";

      const ratingEl = document.getElementById("rrp-overlay-rating");
      const distanceEl = document.getElementById("rrp-overlay-distance");
      const dateEl = document.getElementById("rrp-overlay-date");

      if (ratingEl) ratingEl.textContent = r.rating ? `${r.rating}/5` : "";
      if (distanceEl) distanceEl.textContent = r.home_distance_km != null ? `${Number(r.home_distance_km).toFixed(1)} km` : "";
      if (dateEl) dateEl.textContent = r.created_at ? new Date(r.created_at).toLocaleDateString("sv-SE") : "";

      // Bilder
      const urls = Array.isArray(r.image_urls) ? r.image_urls : [];
      overlayImagesEl.innerHTML = "";
      if (urls.length) {
        urls.forEach((url, idx) => {
          const img = document.createElement("img");
          img.src = url;
          img.alt = "";
          img.loading = "lazy";
          img.addEventListener("click", () => openGallery(urls, idx));
          overlayImagesEl.appendChild(img);
        });
      }

      // Recensionstext (Quill-HTML)
      overlayCommentEl.innerHTML = r.comment || "";

      // Länk
      if (overlayLinkEl) {
        if (r.place_id) {
          overlayLinkEl.href = `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(r.place_id)}`;
          overlayLinkEl.style.display = "";
        } else {
          overlayLinkEl.href = "#";
          overlayLinkEl.style.display = "none";
        }
      }

      overlayEl?.setAttribute("aria-hidden", "false");
      overlayOpen = true;

      loadComments(id);
    }

    function closeOverlay() {
      overlayEl?.setAttribute("aria-hidden", "true");
      overlayOpen = false;
      currentOverlayReviewId = null;
      if (commentStatusEl) commentStatusEl.textContent = "";
    }

    async function loadComments(reviewId) {
      if (!commentsListEl) return;
      commentsListEl.innerHTML = `<p class="rrp-muted">Hämtar kommentarer...</p>`;
      try {
        const data = await apiGet(`/api/comments?review_id=${encodeURIComponent(reviewId)}&status=approved`);
        const comments = data || [];
        if (!comments.length) {
          commentsListEl.innerHTML = `<p class="rrp-muted">Inga kommentarer ännu.</p>`;
          return;
        }

        const wrap = document.createElement("div");
        comments.forEach((c) => {
          const item = document.createElement("div");
          item.className = "rrp-comment";

          const meta = document.createElement("div");
          meta.className = "rrp-comment-meta";
          const name = c.author_name || "Anonym";
          const dateText = c.created_at ? new Date(c.created_at).toLocaleDateString("sv-SE") : "";
          meta.textContent = `${name}${dateText ? " • " + dateText : ""}`;

          const body = document.createElement("div");
          body.className = "rrp-comment-body";
          body.textContent = c.comment || "";

          item.appendChild(meta);
          item.appendChild(body);
          wrap.appendChild(item);
        });

        commentsListEl.innerHTML = "";
        commentsListEl.appendChild(wrap);
      } catch (err) {
        console.error("loadComments error:", err);
        commentsListEl.innerHTML = `<p class="rrp-muted" style="color:#b00020;">Kunde inte hämta kommentarer.</p>`;
      }
    }

    async function onCommentSubmit(e) {
      e.preventDefault();
      if (!currentOverlayReviewId) return;

      const submitBtn = document.getElementById("rrp-comment-submit");
      const nameEl = document.getElementById("rrp-comment-name");
      const emailEl = document.getElementById("rrp-comment-email");
      const textEl = document.getElementById("rrp-comment-text");
      const statusEl = document.getElementById("rrp-comment-status");

      const author_name = (nameEl?.value || "").trim();
      const author_email = (emailEl?.value || "").trim();
      const comment = (textEl?.value || "").trim();

      if (!comment) {
        statusEl.textContent = "Skriv en kommentar först.";
        return;
      }

      submitBtn.disabled = true;
      statusEl.textContent = "Skickar...";

      try {
        await apiPost("/api/comments", {
          review_id: currentOverlayReviewId,
          author_name: author_name || "Anonym",
          author_email: author_email || null,
          comment,
        });

        statusEl.textContent = "Tack! Kommentaren skickades och väntar på godkännande.";
        if (textEl) textEl.value = "";
        if (nameEl) nameEl.value = "";
        if (emailEl) emailEl.value = "";

        // Uppdatera listan (approved-listan kommer kanske inte visa den direkt)
        await loadComments(currentOverlayReviewId);
      } catch (err) {
        console.error("onCommentSubmit error:", err);
        statusEl.textContent = "Kunde inte skicka kommentaren. Försök igen.";
      } finally {
        submitBtn.disabled = false;
      }
    }

    // Maps callback: initiera endast kartan (UI + reviews laddas oavsett)
    window.initRestaurantReviewsPublicMap = function () {
      const mapEl = document.getElementById("rrp-map");
      if (!mapEl) return;

      map = new google.maps.Map(mapEl, {
        center: { lat: HOME_LAT, lng: HOME_LNG },
        zoom: 13,
      });

      infoWindow = new google.maps.InfoWindow();

      // När kartan är redo kan vi rendera markers för de reviews som redan är laddade
      renderMarkers();
    };

    // Exponera initPublicUi till outer scope
    window.__rrpInitPublicUi = initPublicUi;
  })();

  // Boot
  document.addEventListener("DOMContentLoaded", () => {
    renderShellOnce();

    // ✅ Kör UI + hämta reviews direkt (även utan karta)
    if (typeof window.__rrpInitPublicUi === "function") {
      window.__rrpInitPublicUi();
    }

    // ✅ Karta endast om maps-key finns (Squarespace-läge)
    const mapsKey = cfg.googleMapsApiKey;
    if (!mapsKey) {
      console.info("[public] Ingen googleMapsApiKey – kör utan karta (GitHub Pages test).");
      return;
    }

    loadGoogleMaps({ apiKey: mapsKey, callbackName: "initRestaurantReviewsPublicMap" });
  });
})();