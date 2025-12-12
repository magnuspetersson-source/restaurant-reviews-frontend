// RRA Admin – UI + dynamisk Google Maps loader (en enda callback)
// Uppdaterad: lokal-körning (backendBaseUrl fallback), högre karta, bildtexter (images[{url,caption}]) + bakåtkompat.

;(function () {
  // ======= KONFIG =======
  const cfg = window.RR_CONFIG || {};
  const BACKEND_BASE_URL = typeof cfg.backendBaseUrl === "string" ? cfg.backendBaseUrl : "";
  const HOME_LAT = Number(cfg.homeLat);
  const HOME_LNG = Number(cfg.homeLng);

  if (BACKEND_BASE_URL === "") {
    console.info("[admin] RR_CONFIG.backendBaseUrl saknas/tomt → använder same-origin (bra för vercel dev).");
  }
  if (!Number.isFinite(HOME_LAT) || !Number.isFinite(HOME_LNG)) {
    console.error("[admin] Missing/invalid RR_CONFIG.homeLat/homeLng");
  }

  const ICON_REVIEWED = "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
  const ICON_UNREVIEWED = "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
  const ICON_NEAREST_UNREVIEWED = "http://maps.google.com/mapfiles/ms/icons/blue-dot.png";

  // ======= STATE =======
  let map;
  let homeMarker;
  let allReviews = [];
  let currentReview = null;

  // markers från vår egen DB (grön)
  let reviewMarkers = [];
  let reviewMarkerById = {};

  // Places
  let placesService = null;
  let nearbyPlaces = [];
  let placeMarkers = [];
  let nearestUnreviewedPlaceId = null;
  let nearbyLoaded = false;
  let selectedMarker = null;

  // Quill
  let quillComment = null;

  // Kommentars-cache
  let adminCommentsCache = [];

  // ======= ROOT / RENDER =======
  const root = document.getElementById("restaurant-reviews-admin");
  if (!root) {
    console.error("[admin] Missing #restaurant-reviews-admin in HTML");
    return;
  }

  // Rendera UI bara en gång
  function renderShellOnce() {
    if (document.getElementById("rra-main")) return;

    root.innerHTML = `
      <div id="rra-main">
        <!-- Recensions-admin -->
        <div class="rra-card">
          <div class="rra-header">
            <h2>Recensioner</h2>
            <p>
              Välj restaurang genom att klicka på en pin på kartan
              (grön = recenserad, röd = ej recenserad, blå = närmast ej recenserad).
              Du kan fortfarande söka med textfältet vid behov.
            </p>
          </div>

          <div class="rra-layout">
            <!-- Karta -->
            <div>
              <div class="rra-field-group">
                <label for="rra-place-input" class="rra-field-label">
                  Sök restaurang (valfritt)
                </label>
                <input
                  type="text"
                  id="rra-place-input"
                  placeholder="Börja skriva restaurang eller adress..."
                />
              </div>

              <div id="rra-map"></div>
              <div id="rra-places-status" class="rra-muted" style="margin-top:0.25rem;"></div>
            </div>

            <!-- Form + lista -->
            <div>
              <div class="rra-field-group">
                <span class="rra-field-label">Vald restaurang</span>
                <div id="rra-selected-name" class="rra-selected-name">
                  Ingen vald ännu.
                </div>
              </div>

              <div class="rra-row">
                <div class="rra-field-group">
                  <label class="rra-field-label" for="rra-restaurant-type">Typ</label>
                  <input
                    type="text"
                    id="rra-restaurant-type"
                    placeholder="t.ex. Pizza, Sushi, Bistró"
                  />
                </div>
                <div class="rra-field-group">
                  <label class="rra-field-label" for="rra-cost-level">Kostnadsläge</label>
                  <select id="rra-cost-level">
                    <option value="">Välj...</option>
                    <option value="1">$</option>
                    <option value="2">$$</option>
                    <option value="3">$$$</option>
                    <option value="4">$$$$</option>
                    <option value="5">$$$$$</option>
                  </select>
                </div>
              </div>

              <div class="rra-row">
                <div class="rra-field-group">
                  <label class="rra-field-label" for="rra-value-rating">Prisvärdhet</label>
                  <select id="rra-value-rating">
                    <option value="">Välj...</option>
                    <option value="1">1 – Låg</option>
                    <option value="2">2</option>
                    <option value="3">3 – Okej</option>
                    <option value="4">4</option>
                    <option value="5">5 – Mycket hög</option>
                  </select>
                </div>
                <div class="rra-field-group">
                  <label class="rra-field-label" for="rra-rating">Helhetsbetyg</label>
                  <select id="rra-rating">
                    <option value="">Välj...</option>
                    <option value="1">1 ★</option>
                    <option value="2">2 ★★</option>
                    <option value="3">3 ★★★</option>
                    <option value="4">4 ★★★★</option>
                    <option value="5">5 ★★★★★</option>
                  </select>
                </div>
              </div>

              <div class="rra-field-group">
                <label class="rra-field-label">Recensionstext</label>
                <div id="rra-comment-toolbar">
                  <span class="ql-formats">
                    <button class="ql-bold"></button>
                    <button class="ql-italic"></button>
                    <button class="ql-underline"></button>
                  </span>
                  <span class="ql-formats">
                    <button class="ql-list" value="ordered"></button>
                    <button class="ql-list" value="bullet"></button>
                  </span>
                  <span class="ql-formats">
                    <button class="ql-link"></button>
                  </span>
                </div>
                <div id="rra-comment-editor"></div>
                <div class="rra-muted" style="margin-top:0.25rem;">
                  Du kan använda fetstil, kursivt, listor och länkar. Standardtypsnitt följer Squarespace.
                </div>
              </div>

              <div class="rra-field-group">
                <span class="rra-field-label">Avstånd & koordinater</span>
                <div id="rra-distance-meta" class="rra-muted">
                  Avstånd beräknas automatiskt från Ugerupsgatan när en plats valts.
                </div>
              </div>

              <div class="rra-field-group">
                <span class="rra-field-label">Bilder</span>
                <div id="rra-images-drop" class="rra-images-drop">
                  Dra & släpp bilder här eller klicka för att välja.
                  <input
                    id="rra-images-input"
                    type="file"
                    accept="image/*"
                    multiple
                    style="display:none;"
                  />
                </div>
                <div id="rra-images-status" class="rra-muted"></div>

                <div id="rra-upload-progress" style="
                  width: 100%;
                  height: 6px;
                  background: rgba(0,0,0,0.08);
                  border-radius: 4px;
                  overflow: hidden;
                  margin-top: 4px;
                  display: none;
                ">
                  <div id="rra-upload-progress-bar" style="
                    width: 0%;
                    height: 100%;
                    background: #000;
                    transition: width 0.15s ease-out;
                  "></div>
                </div>

                <div id="rra-images-preview" class="rra-images-preview"></div>
              </div>

              <div class="rra-actions">
                <button type="button" id="rra-save-btn" class="rra-btn rra-btn--primary">
                  Spara recension
                </button>
                <button type="button" id="rra-new-btn" class="rra-btn">
                  Ny recension
                </button>
                <button type="button" id="rra-delete-btn" class="rra-btn rra-btn--danger">
                  Ta bort recension
                </button>
                <span id="rra-save-status" class="rra-muted"></span>
              </div>

              <div class="rra-field-group" style="margin-top:0.8rem;">
                <span class="rra-field-label">Befintliga recensioner</span>
                <div id="rra-reviews-list" class="rra-list">
                  <p class="rra-muted">Hämtar recensioner...</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Kommentarsmoderering -->
        <div class="rra-card">
          <div class="rra-header">
            <h2>Kommentarsmoderering</h2>
            <p>Godkänn eller ta bort kommentarer som lämnats på de publika recensionerna.</p>
          </div>

          <div style="display:flex; align-items:center; gap:0.75rem; margin:0.3rem 0 0.7rem;">
            <label for="admin-comments-filter" class="rra-field-label" style="margin-bottom:0;">
              Visa
            </label>
            <select
              id="admin-comments-filter"
              style="padding:0.3rem 0.7rem; border-radius:999px; border:1px solid rgba(0,0,0,0.18); font-size:0.85rem; font-family:inherit;"
            >
              <option value="pending">Endast “Väntar genomläsning”</option>
              <option value="all">Alla kommentarer</option>
            </select>
            <button type="button" id="admin-comments-refresh" class="rra-btn" style="font-size:0.8rem;">
              Uppdatera
            </button>
          </div>

          <div id="admin-comments-list">
            <p class="rra-muted">Inga kommentarer laddade ännu.</p>
          </div>
        </div>
      </div>
    `;
  }

  // ======= CSS INJECTION (karta högre + captionfält) =======
  function injectAdminCssOnce() {
    if (document.getElementById("rra-admin-extra-css")) return;
    const style = document.createElement("style");
    style.id = "rra-admin-extra-css";
    style.textContent = `
      /* Karta ~dubbelt så hög */
      #rra-map { height: 70vh; min-height: 600px; }

      /* Bildcaption input */
      .rra-image-thumb input.rra-image-caption {
        width: 100%;
        margin-top: 6px;
        padding: 8px 10px;
        border: 1px solid rgba(0,0,0,0.18);
        border-radius: 10px;
        font: inherit;
        font-size: 0.9rem;
        background: rgba(255,255,255,0.75);
      }
    `;
    document.head.appendChild(style);
  }

  // ======= HELPERS =======
  function setPlacesStatus(msg) {
    const el = document.getElementById("rra-places-status");
    if (el) el.textContent = msg || "";
  }

  function haversineDistanceKm(lat1, lng1, lat2, lng2) {
    function toRad(x) {
      return (x * Math.PI) / 180;
    }
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function ratingStars(n) {
    if (!n) return "";
    const full = "★".repeat(n);
    const empty = "☆".repeat(5 - n);
    return full + empty;
  }

  function setSelectedMarker(marker) {
    if (selectedMarker && selectedMarker !== marker) {
      try {
        if (selectedMarker._baseIcon) selectedMarker.setIcon(selectedMarker._baseIcon);
      } catch (e) {
        console.warn("Kunde inte återställa ikon för tidigare marker:", e);
      }
    }
    selectedMarker = marker || null;

    if (marker && map && window.google && google.maps && google.maps.Size) {
      const baseIcon = marker._baseIcon || marker.getIcon() || ICON_UNREVIEWED;
      let bigIcon;
      if (typeof baseIcon === "string") {
        bigIcon = { url: baseIcon, scaledSize: new google.maps.Size(40, 40) };
      } else {
        bigIcon = Object.assign({}, baseIcon, { scaledSize: new google.maps.Size(40, 40) });
      }
      marker.setIcon(bigIcon);
    }
  }

  // Normalisera bilddata så admin kan hantera både gamla och nya format
  function normalizeReviewImages(review) {
    if (!review || typeof review !== "object") return review;

    // Nytt format: images = [{url, caption}]
    if (Array.isArray(review.images)) {
      review.images = review.images
        .map((x) => {
          if (!x) return null;
          if (typeof x === "string") return { url: x, caption: "" };
          const url = x.url || x.image_url || x.src || "";
          const caption = x.caption || "";
          if (!url) return null;
          return { url, caption };
        })
        .filter(Boolean);
    } else {
      review.images = [];
    }

    // Gammalt format: image_urls = ["..."]
    if (Array.isArray(review.image_urls) && review.image_urls.length) {
      // Om images saknas/är tom, skapa images från image_urls
      if (!review.images.length) {
        review.images = review.image_urls.map((url) => ({ url, caption: "" }));
      }
    }

    // Se till att image_urls alltid speglar urls (för bakåtkompat vid save/payload)
    review.image_urls = review.images.map((x) => x.url);

    return review;
  }

  // ======= INIT =======
  function initAdminApp() {
    initMap();
    initQuillCommentEditor();
    initFormHandlers();
    initImageUpload();
    initAdminCommentsUI();
    initPlaceAutocomplete();
    loadReviews();
  }

  function initQuillCommentEditor() {
    const el = document.getElementById("rra-comment-editor");
    if (!el || !window.Quill) return;
    quillComment = new Quill("#rra-comment-editor", {
      theme: "snow",
      modules: { toolbar: "#rra-comment-toolbar" },
    });
  }

  // ======= MAP =======
  function initMap() {
    const mapEl = document.getElementById("rra-map");
    if (!mapEl || !window.google || !google.maps) return;

    map = new google.maps.Map(mapEl, {
      center: { lat: HOME_LAT, lng: HOME_LNG },
      zoom: 13,
    });

    homeMarker = new google.maps.Marker({
      map,
      position: { lat: HOME_LAT, lng: HOME_LNG },
      title: "Hem (Ugerupsgatan)",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        strokeColor: "#0b8043",
        strokeWeight: 2,
      },
    });

    if (google.maps.places) {
      placesService = new google.maps.places.PlacesService(map);
      setPlacesStatus("Försöker hämta restauranger från Google Places…");
    } else {
      setPlacesStatus("Google Places-biblioteket kunde inte laddas.");
    }
  }

  function clearReviewMarkers() {
    reviewMarkers.forEach((m) => m.setMap(null));
    reviewMarkers = [];
    reviewMarkerById = {};
  }

  function renderReviewMarkers() {
    if (!map) return;
    clearReviewMarkers();

    allReviews.forEach((r) => {
      if (r.restaurant_lat == null || r.restaurant_lng == null) return;

      const marker = new google.maps.Marker({
        map,
        position: { lat: r.restaurant_lat, lng: r.restaurant_lng },
        title: r.place_name || "",
        icon: ICON_REVIEWED,
      });
      marker._baseIcon = ICON_REVIEWED;

      reviewMarkers.push(marker);
      reviewMarkerById[r.id] = marker;

      marker.addListener("click", () => selectReview(r.id));
    });
  }

  // ======= PLACES =======
  function clearPlaceMarkers() {
    placeMarkers.forEach((m) => m.setMap(null));
    placeMarkers = [];
  }

  function loadNearbyRestaurants() {
    if (!map || !placesService || nearbyLoaded) return;
    nearbyLoaded = true;

    const request = {
      location: { lat: HOME_LAT, lng: HOME_LNG },
      radius: 3000,
      type: "restaurant",
    };

    setPlacesStatus("Kontaktar Google Places…");
    placesService.nearbySearch(request, (results, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
        setPlacesStatus("Google Places kunde inte hämta restauranger (status: " + status + ").");
        return;
      }

      setPlacesStatus("Google Places laddade " + results.length + " restauranger i närheten.");
      nearbyPlaces = results;
      computeNearestUnreviewed();
      renderPlaceMarkers();
    });
  }

  function computeNearestUnreviewed() {
    let bestDist = Infinity;
    let bestPlaceId = null;

    nearbyPlaces.forEach((p) => {
      if (!p.geometry || !p.geometry.location || !p.place_id) return;
      const reviewed = allReviews.some((r) => r.place_id === p.place_id);
      if (reviewed) return;

      const lat = p.geometry.location.lat();
      const lng = p.geometry.location.lng();
      const dist = haversineDistanceKm(HOME_LAT, HOME_LNG, lat, lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestPlaceId = p.place_id;
      }
    });

    nearestUnreviewedPlaceId = bestPlaceId;
  }

  function renderPlaceMarkers() {
    if (!map) return;
    clearPlaceMarkers();

    nearbyPlaces.forEach((p) => {
      if (!p.geometry || !p.geometry.location) return;

      const reviewed = allReviews.find((r) => r.place_id === p.place_id);
      let icon = reviewed ? ICON_REVIEWED : ICON_UNREVIEWED;
      if (p.place_id === nearestUnreviewedPlaceId && !reviewed) icon = ICON_NEAREST_UNREVIEWED;

      const marker = new google.maps.Marker({
        map,
        position: p.geometry.location,
        title: p.name,
        icon,
      });
      marker._baseIcon = icon;

      marker._place = p;
      marker._review = reviewed || null;

      marker.addListener("click", () => onPlaceMarkerClick(marker));
      placeMarkers.push(marker);
    });
  }

  function newEmptyReviewFromPlace(place, lat, lng, dist) {
    return normalizeReviewImages({
      place_id: place.place_id,
      place_name: place.name || "",
      restaurant_lat: lat,
      restaurant_lng: lng,
      home_distance_km: dist,
      restaurant_type: "",
      rating: null,
      value_rating: null,
      cost_level: null,
      // bakåtkompat:
      image_urls: [],
      // nytt:
      images: [],
      comment: "",
    });
  }

  function onPlaceMarkerClick(marker) {
    const p = marker._place;
    const existingReview = marker._review;

    if (existingReview) {
      currentReview = normalizeReviewImages({ ...existingReview });
    } else {
      const loc = p.geometry.location;
      const lat = loc.lat();
      const lng = loc.lng();
      const dist = haversineDistanceKm(HOME_LAT, HOME_LNG, lat, lng);
      currentReview = newEmptyReviewFromPlace(p, lat, lng, dist);
    }

    updateFormFromState();

    if (map) {
      map.panTo(marker.getPosition());
      map.setZoom(15);
      setSelectedMarker(marker);
    }

    const addr = p.vicinity || p.formatted_address || "";
    const distText =
      currentReview && currentReview.home_distance_km != null
        ? currentReview.home_distance_km.toFixed(1) + " km från Ugerupsgatan"
        : "";
    setPlacesStatus((addr || "Vald plats") + (distText ? " • " + distText : ""));
  }

  // ======= AUTOCOMPLETE =======
  function initPlaceAutocomplete() {
    const input = document.getElementById("rra-place-input");
    if (!input || !window.google || !google.maps || !google.maps.places) return;

    const autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ["place_id", "name", "geometry", "formatted_address", "vicinity"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place || !place.geometry || !place.geometry.location || !place.place_id) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const dist = haversineDistanceKm(HOME_LAT, HOME_LNG, lat, lng);

      const existingReview = allReviews.find((r) => r.place_id === place.place_id);
      currentReview = existingReview
        ? normalizeReviewImages({ ...existingReview })
        : newEmptyReviewFromPlace(place, lat, lng, dist);

      updateFormFromState();

      if (map) {
        map.panTo({ lat, lng });
        map.setZoom(15);
      }

      const addr = place.vicinity || place.formatted_address || "";
      setPlacesStatus((addr || "Vald plats") + " • " + dist.toFixed(1) + " km från Ugerupsgatan");
    });
  }

  // ======= REVIEWS API =======
  async function loadReviews() {
    const listEl = document.getElementById("rra-reviews-list");
    if (listEl) listEl.innerHTML = '<p class="rra-muted">Hämtar recensioner...</p>';

    try {
      const res = await fetch(BACKEND_BASE_URL + "/api/reviews");
      if (!res.ok) throw new Error("Failed to fetch reviews");
      const data = await res.json();
      allReviews = (data || []).map((r) => normalizeReviewImages(r));
      renderReviewsList();
      renderReviewMarkers();
      loadNearbyRestaurants();
    } catch (err) {
      console.error("loadReviews error:", err);
      if (listEl) {
        listEl.innerHTML =
          '<p class="rra-muted" style="color:#b00020;">Kunde inte hämta recensioner.</p>';
      }
    }
  }

  function renderReviewsList() {
    const listEl = document.getElementById("rra-reviews-list");
    if (!listEl) return;

    if (!allReviews.length) {
      listEl.innerHTML = '<p class="rra-muted">Inga recensioner ännu.</p>';
      return;
    }

    const container = document.createElement("div");
    allReviews
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .forEach((r) => {
        const item = document.createElement("div");
        item.className = "rra-list-item";
        item.dataset.id = r.id;

        if (currentReview && currentReview.id === r.id) item.classList.add("active");

        const left = document.createElement("div");
        const title = document.createElement("div");
        title.className = "rra-list-item-title";
        title.textContent = r.place_name || "Okänd restaurang";

        const meta = document.createElement("div");
        meta.className = "rra-list-item-meta";
        const parts = [];
        if (r.rating) parts.push(ratingStars(r.rating) + " (" + r.rating + "/5)");
        if (r.restaurant_type) parts.push(r.restaurant_type);
        if (r.home_distance_km != null) parts.push(r.home_distance_km.toFixed(1) + " km");
        meta.textContent = parts.join(" • ");

        left.appendChild(title);
        left.appendChild(meta);

        const right = document.createElement("div");
        right.className = "rra-list-item-meta";
        if (r.created_at) right.textContent = new Date(r.created_at).toLocaleDateString("sv-SE");

        item.appendChild(left);
        item.appendChild(right);

        item.addEventListener("click", () => selectReview(r.id));
        container.appendChild(item);
      });

    listEl.innerHTML = "";
    listEl.appendChild(container);
  }

  function selectReview(id) {
    const r = allReviews.find((x) => x.id === id);
    if (!r) return;
    currentReview = normalizeReviewImages({ ...r });
    updateFormFromState();
    renderReviewsList();

    const m = reviewMarkerById[id];
    if (m && map) {
      map.panTo(m.getPosition());
      map.setZoom(15);
      setSelectedMarker(m);
    }
  }

  function resetForm() {
    currentReview = null;
    const nameEl = document.getElementById("rra-selected-name");
    const typeEl = document.getElementById("rra-restaurant-type");
    const costEl = document.getElementById("rra-cost-level");
    const valEl = document.getElementById("rra-value-rating");
    const ratingEl = document.getElementById("rra-rating");
    const distEl = document.getElementById("rra-distance-meta");
    if (nameEl) nameEl.textContent = "Ingen vald ännu.";
    if (typeEl) typeEl.value = "";
    if (costEl) costEl.value = "";
    if (valEl) valEl.value = "";
    if (ratingEl) ratingEl.value = "";
    if (distEl) distEl.textContent = "Avstånd beräknas automatiskt från Ugerupsgatan när en plats valts.";
    if (quillComment) quillComment.setContents([]);
    updateImagesPreview();
    setSelectedMarker(null);
    renderReviewsList();
    setPlacesStatus("");
  }

  function updateFormFromState() {
    const nameEl = document.getElementById("rra-selected-name");
    const typeEl = document.getElementById("rra-restaurant-type");
    const costEl = document.getElementById("rra-cost-level");
    const valEl = document.getElementById("rra-value-rating");
    const ratingEl = document.getElementById("rra-rating");
    const distEl = document.getElementById("rra-distance-meta");

    if (!currentReview) {
      resetForm();
      return;
    }

    normalizeReviewImages(currentReview);

    if (nameEl) nameEl.textContent = currentReview.place_name || "Okänd restaurang";
    if (typeEl) typeEl.value = currentReview.restaurant_type || "";
    if (costEl) costEl.value = currentReview.cost_level != null ? String(currentReview.cost_level) : "";
    if (valEl) valEl.value = currentReview.value_rating != null ? String(currentReview.value_rating) : "";
    if (ratingEl) ratingEl.value = currentReview.rating != null ? String(currentReview.rating) : "";

    if (quillComment) {
      const html = currentReview.comment || "";
      quillComment.clipboard.dangerouslyPasteHTML(html);
    }

    if (distEl) {
      distEl.textContent =
        currentReview.home_distance_km != null
          ? currentReview.home_distance_km.toFixed(1) + " km från Ugerupsgatan"
          : "Avstånd okänt.";
    }

    updateImagesPreview();
  }

  function collectFormToState() {
    if (!currentReview) currentReview = {};
    normalizeReviewImages(currentReview);

    const typeEl = document.getElementById("rra-restaurant-type");
    const costEl = document.getElementById("rra-cost-level");
    const valEl = document.getElementById("rra-value-rating");
    const ratingEl = document.getElementById("rra-rating");

    currentReview.restaurant_type = typeEl ? typeEl.value.trim() : null;

    const costVal = costEl ? costEl.value : "";
    currentReview.cost_level = costVal ? Number(costVal) : null;

    const valVal = valEl ? valEl.value : "";
    currentReview.value_rating = valVal ? Number(valVal) : null;

    const ratingVal = ratingEl ? ratingEl.value : "";
    currentReview.rating = ratingVal ? Number(ratingVal) : null;

    if (quillComment) {
      const html = quillComment.root.innerHTML.trim();
      currentReview.comment = html === "<p><br></p>" ? "" : html;
    }

    // Säkerställ att images finns
    if (!Array.isArray(currentReview.images)) currentReview.images = [];
    currentReview.images = currentReview.images
      .map((x) => (x && x.url ? { url: x.url, caption: x.caption || "" } : null))
      .filter(Boolean);

    // Bakåtkompat-fält
    currentReview.image_urls = currentReview.images.map((x) => x.url);
  }

  // ======= FORM HANDLERS =======
  function initFormHandlers() {
    const saveBtn = document.getElementById("rra-save-btn");
    const newBtn = document.getElementById("rra-new-btn");
    const deleteBtn = document.getElementById("rra-delete-btn");
    if (saveBtn) saveBtn.addEventListener("click", onSaveReview);
    if (newBtn) newBtn.addEventListener("click", resetForm);
    if (deleteBtn) deleteBtn.addEventListener("click", onDeleteReview);
  }

  async function onSaveReview() {
    const statusEl = document.getElementById("rra-save-status");
    if (statusEl) statusEl.textContent = "";
    collectFormToState();
    const r = currentReview;

    if (!r || !r.place_id || !r.place_name) {
      if (statusEl) statusEl.textContent = "Välj först en plats (klicka på en pin eller använd sök).";
      return;
    }
    if (!r.rating) {
      if (statusEl) statusEl.textContent = "Helhetsbetyg krävs.";
      return;
    }

    // Skicka både "images" (nytt) och "imageUrls" (bakåtkompat)
    const imageUrls = Array.isArray(r.images) ? r.images.map((x) => x.url) : [];

    const payload = {
      placeId: r.place_id,
      placeName: r.place_name,
      reviewerName: "Admin",
      rating: r.rating,
      comment: r.comment || "",
      restaurantType: r.restaurant_type || null,
      costLevel: r.cost_level,
      valueRating: r.value_rating,
      homeDistanceKm: r.home_distance_km,
      restaurantLat: r.restaurant_lat,
      restaurantLng: r.restaurant_lng,

      // bakåtkompat (backend idag)
      imageUrls,

      // nytt (för captions)
      images: Array.isArray(r.images) ? r.images : [],
    };

    const isUpdate = !!r.id;
    const url = BACKEND_BASE_URL + "/api/reviews";
    const method = isUpdate ? "PUT" : "POST";
    if (isUpdate) payload.id = r.id;

    try {
      if (statusEl) statusEl.textContent = "Sparar...";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save review");
      const data = normalizeReviewImages(await res.json());

      if (isUpdate) {
        const idx = allReviews.findIndex((x) => x.id === r.id);
        if (idx >= 0) allReviews[idx] = data;
      } else {
        allReviews.unshift(data);
      }
      currentReview = data;
      updateFormFromState();
      renderReviewsList();
      renderReviewMarkers();
      computeNearestUnreviewed();
      renderPlaceMarkers();
      if (statusEl) statusEl.textContent = "Sparad.";
    } catch (err) {
      console.error("onSaveReview error:", err);
      if (statusEl) statusEl.textContent = "Kunde inte spara recensionen.";
    }
  }

  async function onDeleteReview() {
    if (!currentReview || !currentReview.id) {
      alert("Ingen recension vald att ta bort.");
      return;
    }
    if (!confirm("Ta bort denna recension permanent?")) return;

    const statusEl = document.getElementById("rra-save-status");
    try {
      if (statusEl) statusEl.textContent = "Tar bort...";
      const res = await fetch(BACKEND_BASE_URL + "/api/reviews?id=" + encodeURIComponent(currentReview.id), {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete");

      allReviews = allReviews.filter((x) => x.id !== currentReview.id);
      currentReview = null;
      resetForm();
      renderReviewMarkers();
      computeNearestUnreviewed();
      renderPlaceMarkers();
      if (statusEl) statusEl.textContent = "Borttagen.";
    } catch (err) {
      console.error("onDeleteReview error:", err);
      if (statusEl) statusEl.textContent = "Kunde inte ta bort recensionen.";
    }
  }

  // ======= BILDER =======
  function initImageUpload() {
    const dropEl = document.getElementById("rra-images-drop");
    const inputEl = document.getElementById("rra-images-input");
    const statusEl = document.getElementById("rra-images-status");
    if (!dropEl || !inputEl) return;

    function handleFiles(files) {
      if (!files || !files.length) return;
      uploadImages(files);
    }

    dropEl.addEventListener("click", () => inputEl.click());
    inputEl.addEventListener("change", () => {
      handleFiles(inputEl.files);
      inputEl.value = "";
    });

    dropEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropEl.style.background = "rgba(0,0,0,0.04)";
    });
    dropEl.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropEl.style.background = "rgba(0,0,0,0.01)";
    });
    dropEl.addEventListener("drop", (e) => {
      e.preventDefault();
      dropEl.style.background = "rgba(0,0,0,0.01)";
      const dt = e.dataTransfer;
      if (dt && dt.files) handleFiles(dt.files);
    });

    function uploadFormDataWithProgress(url, formData, onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);

        xhr.upload.onprogress = function (event) {
          if (event.lengthComputable && typeof onProgress === "function") {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };

        xhr.onreadystatechange = function () {
          if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const json = JSON.parse(xhr.responseText || "{}");
                resolve(json);
              } catch (err) {
                reject(err);
              }
            } else {
              reject(new Error("Upload failed with status " + xhr.status));
            }
          }
        };

        xhr.onerror = function () {
          reject(new Error("Network error"));
        };

        xhr.send(formData);
      });
    }

    async function uploadImages(files) {
      if (!currentReview) {
        if (statusEl) statusEl.textContent = "Välj först en plats innan du laddar upp bilder.";
        return;
      }
      if (!files || !files.length) return;
      if (statusEl) statusEl.textContent = "";

      normalizeReviewImages(currentReview);

      const progressContainer = document.getElementById("rra-upload-progress");
      const progressBar = document.getElementById("rra-upload-progress-bar");

      if (progressContainer && progressBar) {
        progressContainer.style.display = "block";
        progressBar.style.width = "0%";
      }

      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      formData.append("placeId", currentReview.place_id || "");
      formData.append("placeName", currentReview.place_name || "");

      try {
        if (statusEl) statusEl.textContent = "Laddar upp bilder...";

        const data = await uploadFormDataWithProgress(BACKEND_BASE_URL + "/api/upload-image", formData, (percent) => {
          if (progressBar) progressBar.style.width = percent + "%";
        });

        const urls = Array.isArray(data.urls) ? data.urls : [];

        if (!Array.isArray(currentReview.images)) currentReview.images = [];
        urls.forEach((url) => {
          currentReview.images.push({ url, caption: "" });
        });

        // bakåtkompat:
        currentReview.image_urls = currentReview.images.map((x) => x.url);

        updateImagesPreview();

        if (statusEl) statusEl.textContent = "Bilder uppladdade.";
        if (progressContainer && progressBar) {
          progressBar.style.width = "100%";
          setTimeout(() => {
            progressContainer.style.display = "none";
            progressBar.style.width = "0%";
          }, 600);
        }
      } catch (err) {
        console.error("[RRA upload] error:", err);
        if (statusEl) statusEl.textContent = "Kunde inte ladda upp bilder.";
        if (progressContainer && progressBar) {
          progressContainer.style.display = "none";
          progressBar.style.width = "0%";
        }
      }
    }
  }

  function updateImagesPreview() {
    const previewEl = document.getElementById("rra-images-preview");
    if (!previewEl) return;
    previewEl.innerHTML = "";

    if (!currentReview) return;
    normalizeReviewImages(currentReview);

    if (!Array.isArray(currentReview.images) || !currentReview.images.length) return;

    currentReview.images.forEach((imgObj, index) => {
      const wrap = document.createElement("div");
      wrap.className = "rra-image-thumb";

      const img = document.createElement("img");
      img.src = imgObj.url;
      img.alt = imgObj.caption || "Recensionsbild " + (index + 1);
      wrap.appendChild(img);

      const caption = document.createElement("input");
      caption.className = "rra-image-caption";
      caption.type = "text";
      caption.placeholder = "Bildtext (visas i frontend)";
      caption.value = imgObj.caption || "";
      caption.addEventListener("input", () => {
        imgObj.caption = caption.value;
        // håll bakåtkompat synkat
        currentReview.image_urls = currentReview.images.map((x) => x.url);
      });
      wrap.appendChild(caption);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "×";
      btn.title = "Ta bort bild";
      btn.addEventListener("click", () => {
        currentReview.images.splice(index, 1);
        currentReview.image_urls = currentReview.images.map((x) => x.url);
        updateImagesPreview();
      });
      wrap.appendChild(btn);

      previewEl.appendChild(wrap);
    });
  }

  // ======= KOMMENTARER (moderering) =======
  async function loadAdminComments(filter) {
    const listEl = document.getElementById("admin-comments-list");
    if (!listEl) return;
    listEl.innerHTML = '<p class="rra-muted">Hämtar kommentarer...</p>';

    try {
      let url = BACKEND_BASE_URL + "/api/comments";
      if (filter === "pending") url += "?status=pending";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch comments");
      const data = await res.json();
      adminCommentsCache = data || [];
      renderAdminComments(adminCommentsCache);
    } catch (err) {
      console.error("loadAdminComments error:", err);
      listEl.innerHTML = '<p class="rra-muted" style="color:#b00020;">Kunde inte hämta kommentarer.</p>';
    }
  }

  function renderAdminComments(comments) {
    const listEl = document.getElementById("admin-comments-list");
    if (!listEl) return;

    if (!comments.length) {
      listEl.innerHTML = '<p class="rra-muted">Inga kommentarer att visa.</p>';
      return;
    }

    const container = document.createElement("div");
    container.className = "rra-comments-list";

    comments.forEach((c) => {
      const card = document.createElement("div");
      card.className = "rra-comment-item";

      const metaRow = document.createElement("div");
      metaRow.className = "rra-comment-meta";

      const left = document.createElement("div");
      const name = c.author_name || "Anonym";
      const dateText = c.created_at
        ? new Date(c.created_at).toLocaleString("sv-SE", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";

      const matchingReview = allReviews.find((r) => r.id === c.review_id);
      const restaurantName = matchingReview ? matchingReview.place_name || "Okänd restaurang" : "Okänd restaurang";
      left.textContent = name + (dateText ? " • " + dateText : "") + " • " + restaurantName;

      const right = document.createElement("div");
      if (c.status === "pending") {
        right.textContent = "Väntar genomläsning";
        right.style.fontWeight = "600";
      } else if (c.status === "approved") {
        right.textContent = "Godkänd";
      } else if (c.status === "rejected") {
        right.textContent = "Ej publicerad";
      } else {
        right.textContent = c.status || "";
      }

      metaRow.appendChild(left);
      metaRow.appendChild(right);

      const body = document.createElement("div");
      body.className = "rra-comment-body";
      body.textContent = c.comment || "";

      const btnRow = document.createElement("div");
      btnRow.className = "rra-comment-buttons";

      if (c.status !== "approved") {
        const approveBtn = document.createElement("button");
        approveBtn.type = "button";
        approveBtn.textContent = "Godkänn";
        approveBtn.className = "rra-btn";
        approveBtn.style.borderColor = "#0b8043";
        approveBtn.style.fontSize = "0.8rem";
        approveBtn.addEventListener("click", () => approveComment(c.id));
        btnRow.appendChild(approveBtn);
      }

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = "Ta bort";
      deleteBtn.className = "rra-btn rra-btn--danger";
      deleteBtn.style.fontSize = "0.8rem";
      deleteBtn.addEventListener("click", () => deleteComment(c.id));
      btnRow.appendChild(deleteBtn);

      card.appendChild(metaRow);
      card.appendChild(body);
      card.appendChild(btnRow);
      container.appendChild(card);
    });

    listEl.innerHTML = "";
    listEl.appendChild(container);
  }

  async function approveComment(id) {
    const filterEl = document.getElementById("admin-comments-filter");
    const currentFilter = filterEl ? filterEl.value : "pending";
    if (!confirm("Godkänna denna kommentar?")) return;

    try {
      const res = await fetch(BACKEND_BASE_URL + "/api/comments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "approved" }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      await loadAdminComments(currentFilter);
    } catch (err) {
      console.error("approveComment error:", err);
      alert("Kunde inte godkänna kommentaren.");
    }
  }

  async function deleteComment(id) {
    const filterEl = document.getElementById("admin-comments-filter");
    const currentFilter = filterEl ? filterEl.value : "pending";
    if (!confirm("Ta bort denna kommentar permanent?")) return;

    try {
      const res = await fetch(BACKEND_BASE_URL + "/api/comments?id=" + encodeURIComponent(id), { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete");
      await loadAdminComments(currentFilter);
    } catch (err) {
      console.error("deleteComment error:", err);
      alert("Kunde inte ta bort kommentaren.");
    }
  }

  function initAdminCommentsUI() {
    const filterEl = document.getElementById("admin-comments-filter");
    const refreshBtn = document.getElementById("admin-comments-refresh");
    if (filterEl) {
      filterEl.addEventListener("change", () => loadAdminComments(filterEl.value || "pending"));
    }
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        const currentFilter = filterEl ? filterEl.value : "pending";
        loadAdminComments(currentFilter);
      });
    }
    loadAdminComments("pending");
  }

  // ======= GOOGLE MAPS LOADER (ENDAST EN) =======
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
      `&libraries=places` +
      `&loading=async` +
      `&callback=${encodeURIComponent(callbackName)}`;

    script.onerror = () => console.error("[admin] Failed to load Google Maps");
    document.head.appendChild(script);
  }

  // ======= CALLBACK (ENDAST EN) =======
  window.initRestaurantReviewsAdmin = function () {
    initAdminApp();
  };

  // ======= BOOT =======
  document.addEventListener("DOMContentLoaded", () => {
    renderShellOnce();
    injectAdminCssOnce();

    const mapsKey = cfg.googleMapsApiKey;
    if (!mapsKey) {
      console.error("[admin] Missing RR_CONFIG.googleMapsApiKey");
      return;
    }
    loadGoogleMaps({ apiKey: mapsKey, callbackName: "initRestaurantReviewsAdmin" });
  });
})();