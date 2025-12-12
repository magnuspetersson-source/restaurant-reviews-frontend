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
    if (document.getElementById("rrp-map")) return; // redan renderad

    root.innerHTML = `
<div class="rrp-header">
  <h2>Recenserade restauranger</h2>
  <p>
    Klicka på en pin på kartan eller på en rad i listan för att se detaljer.
  </p>

  <div class="rrp-controls">
    <div class="rrp-filter">
      <label for="rrp-filter-search">Sök</label>
      <input id="rrp-filter-search" type="text" placeholder="Sök namn, typ, text..." />
    </div>

    <div class="rrp-filter">
      <label for="rrp-filter-type">Typ</label>
      <select id="rrp-filter-type">
        <option value="">Alla</option>
      </select>
    </div>

    <div class="rrp-filter">
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

    <div class="rrp-filter">
      <label for="rrp-filter-min-rating">Min betyg</label>
      <select id="rrp-filter-min-rating">
        <option value="">Alla</option>
        <option value="5">5 ★★★★★</option>
        <option value="4">4 ★★★★</option>
        <option value="3">3 ★★★</option>
        <option value="2">2 ★★</option>
        <option value="1">1 ★</option>
      </select>
    </div>

    <div class="rrp-filter">
      <label for="rrp-sort">Sortera</label>
      <select id="rrp-sort">
        <option value="newest">Nyast</option>
        <option value="rating">Betyg</option>
        <option value="distance">Avstånd</option>
        <option value="name">Namn</option>
      </select>
    </div>
  </div>
</div>

<div class="rrp-layout">
  <div class="rrp-map-wrap">
    <div id="rrp-map"></div>
  </div>

  <div class="rrp-list-wrap">
    <div id="rrp-list"></div>
  </div>
</div>

<!-- Overlay (detaljvy) -->
<div id="rrp-overlay" class="rrp-overlay" aria-hidden="true">
  <div class="rrp-overlay-backdrop" data-close="1"></div>
  <div class="rrp-overlay-panel" role="dialog" aria-modal="true">
    <button id="rrp-overlay-close" class="rrp-overlay-close" type="button" aria-label="Stäng">×</button>

    <div class="rrp-overlay-content">
      <h3 id="rrp-overlay-title"></h3>

      <div id="rrp-overlay-meta" class="rrp-overlay-meta">
        <span id="rrp-overlay-rating"></span>
        <span id="rrp-overlay-distance"></span>
        <span id="rrp-overlay-date"></span>
      </div>

      <div id="rrp-overlay-images" class="rrp-overlay-images"></div>

      <div id="rrp-overlay-comment" class="rrp-overlay-comment"></div>

      <a id="rrp-overlay-link" class="rrp-overlay-link" href="#" target="_blank" rel="noopener">Öppna i Google Maps</a>

      <div id="rrp-comments-section" class="rrp-comments">
        <h4>Kommentarer</h4>
        <div id="rrp-comments-list" class="rrp-comments-list"></div>

        <div id="rrp-comment-form-wrapper" class="rrp-comment-form-wrap">
          <h5>Lämna en kommentar</h5>

          <form id="rrp-comment-form" class="rrp-comment-form">
            <div class="rrp-comment-row">
              <input id="rrp-comment-name" type="text" placeholder="Namn" />
              <input id="rrp-comment-email" type="email" placeholder="E-post (valfritt)" />
            </div>
            <textarea id="rrp-comment-text" rows="4" placeholder="Skriv din kommentar..."></textarea>
            <button id="rrp-comment-submit" type="submit">Skicka</button>
            <div id="rrp-comment-status" class="rrp-muted"></div>
          </form>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Bildgalleri-overlay -->
<div id="rrp-gallery-overlay" class="rrp-gallery-overlay" aria-hidden="true">
  <div class="rrp-gallery-backdrop" data-close="1"></div>
  <div class="rrp-gallery-panel" role="dialog" aria-modal="true">
    <button id="rrp-gallery-close" class="rrp-gallery-close" type="button" aria-label="Stäng">×</button>
    <button id="rrp-gallery-prev" class="rrp-gallery-nav" type="button" aria-label="Föregående">‹</button>
    <button id="rrp-gallery-next" class="rrp-gallery-nav" type="button" aria-label="Nästa">›</button>
    <div class="rrp-gallery-inner">
      <img id="rrp-gallery-image" alt="" />
      <div id="rrp-gallery-counter" class="rrp-gallery-counter"></div>
    </div>
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

  ;(function () {
  
    // Marker-ikon (recenserad restaurang)
    const ICON_REVIEWED =
      "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
  
    let map;
    let infoWindow;
    let allReviews = [];
    let filteredReviews = [];
    let markers = [];
    let markerById = {};
    let activeId = null;
    let currentOverlayReviewId = null;
    let selectedMarker = null; // för uppskalad marker
  
    // Overlay DOM
    let overlayEl,
      overlayTitleEl,
      overlayMetaEl,
      overlayRatingEl,
      overlayCommentEl,
      overlayImagesEl,
      overlayDistanceEl,
      overlayDateEl,
      overlayLinkEl;
  
    // Galleri state
    let galleryOverlayEl,
      galleryImgEl,
      galleryPrevBtn,
      galleryNextBtn,
      galleryCounterEl;
    let currentGalleryImages = [];
    let currentGalleryIndex = 0;
  
    function apiGet(path) {
      return fetch(BACKEND_BASE_URL + path).then((res) => {
        if (!res.ok) throw new Error("GET " + path + " failed");
        return res.json();
      });
    }
  
    function clearMarkers() {
      markers.forEach((m) => m.setMap(null));
      markers = [];
      markerById = {};
      selectedMarker = null;
    }
  
    function boundsFromReviews(reviews) {
      const bounds = new google.maps.LatLngBounds();
      let hasAny = false;
      reviews.forEach((r) => {
        if (r.restaurant_lat != null && r.restaurant_lng != null) {
          bounds.extend(new google.maps.LatLng(r.restaurant_lat, r.restaurant_lng));
          hasAny = true;
        }
      });
      return hasAny ? bounds : null;
    }
  
    function ratingStars(n) {
      if (!n) return "";
      const full = "★".repeat(n);
      const empty = "☆".repeat(5 - n);
      return full + empty;
    }
  
    function costToDollars(cost) {
      if (!cost) return "";
      return "$".repeat(cost);
    }
  
    function googleMapsUrl(r) {
      if (!r.place_id) return "#";
      return (
        "https://www.google.com/maps/place/?q=place_id:" +
        encodeURIComponent(r.place_id)
      );
    }
  
    function populateTypeFilterOptions() {
      const select = document.getElementById("rrp-filter-type");
      if (!select) return;
      const types = Array.from(
        new Set(
          allReviews
            .map((r) => (r.restaurant_type || "").trim())
            .filter((s) => s.length)
        )
      ).sort((a, b) => a.localeCompare(b, "sv"));
      select.innerHTML = '<option value="">Alla</option>';
      types.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        select.appendChild(opt);
      });
    }
  
    function applyFilters() {
      const search = document
        .getElementById("rrp-filter-search")
        .value.toLowerCase()
        .trim();
      const typeValue = document.getElementById("rrp-filter-type").value;
      const cost = document.getElementById("rrp-filter-cost").value;
      const minRating = document.getElementById("rrp-filter-min-rating").value;
  
      filteredReviews = allReviews.filter((r) => {
        if (search) {
          const hay =
            (r.place_name || "") +
            " " +
            (r.restaurant_type || "") +
            " " +
            (r.comment || "");
          if (!hay.toLowerCase().includes(search)) return false;
        }
  
        if (typeValue) {
          if ((r.restaurant_type || "") !== typeValue) return false;
        }
  
        if (cost) {
          if (r.cost_level !== Number(cost)) return false;
        }
  
        if (minRating) {
          if (!r.rating || r.rating < Number(minRating)) return false;
        }
  
        return true;
      });
  
      applySort();
      renderList();
      renderMarkers();
    }
  
    function applySort() {
      const sort = document.getElementById("rrp-sort").value;
      filteredReviews.sort((a, b) => {
        const da = new Date(a.created_at).getTime();
        const db = new Date(b.created_at).getTime();
        const ra = a.rating || 0;
        const rb = b.rating || 0;
        const va = a.value_rating || 0;
        const vb = b.value_rating || 0;
        const distA = a.home_distance_km ?? Number.POSITIVE_INFINITY;
        const distB = b.home_distance_km ?? Number.POSITIVE_INFINITY;
  
        switch (sort) {
          case "date_asc":
            return da - db;
          case "date_desc":
            return db - da;
          case "rating_asc":
            return ra - rb;
          case "rating_desc":
            return rb - ra;
          case "distance_asc":
            return distA - distB;
          case "distance_desc":
            return distB - distA;
          case "value_desc":
            return vb - va;
          default:
            return db - da;
        }
      });
    }
  
    function renderList() {
      const listEl = document.getElementById("rrp-list");
      listEl.innerHTML = "";
  
      if (!filteredReviews.length) {
        listEl.innerHTML = '<p class="rrp-muted">Inga restauranger matchar filtren.</p>';
        return;
      }
  
      filteredReviews.forEach((r) => {
        const card = document.createElement("div");
        card.className = "rrp-card";
        card.id = "rrp-card-" + r.id;
        card.dataset.id = r.id;
  
        if (activeId === r.id) card.classList.add("active");
  
        const topline = document.createElement("div");
        topline.className = "rrp-topline";
  
        const distText =
          r.home_distance_km != null
            ? r.home_distance_km.toFixed(1) + " km från hem"
            : "";
        const dateText = r.created_at
          ? new Date(r.created_at).toLocaleDateString("sv-SE")
          : "";
  
        const tlLeft = document.createElement("span");
        tlLeft.textContent = distText;
  
        const tlRight = document.createElement("span");
        tlRight.textContent = dateText;
  
        topline.appendChild(tlLeft);
        topline.appendChild(tlRight);
  
        const titleRow = document.createElement("div");
        titleRow.className = "rrp-title-row";
  
        const nameEl = document.createElement("div");
        nameEl.className = "rrp-name";
        nameEl.textContent = r.place_name || "Okänd restaurang";
  
        const starsEl = document.createElement("div");
        starsEl.className = "rrp-stars";
        starsEl.textContent = ratingStars(r.rating || 0);
  
        titleRow.appendChild(nameEl);
        titleRow.appendChild(starsEl);
  
        const meta = document.createElement("div");
        meta.className = "rrp-meta";
        const parts = [];
        if (r.restaurant_type) parts.push(r.restaurant_type);
        if (r.cost_level) parts.push(costToDollars(r.cost_level));
        if (r.value_rating)
          parts.push("Prisvärdhet " + r.value_rating + "/5");
        meta.textContent = parts.join(" • ");
  
        const comment = document.createElement("div");
        comment.className = "rrp-comment";
        // Viktigt: rendera HTML från Quill
        comment.innerHTML = r.comment || "";
  
        card.appendChild(topline);
        card.appendChild(titleRow);
        if (meta.textContent) card.appendChild(meta);
        card.appendChild(comment);
  
        card.addEventListener("click", () => {
          activeId = r.id;
          renderList();
          focusOnRestaurant(r.id);
          openOverlay(r);
        });
  
        listEl.appendChild(card);
      });
    }
  
    // Marker highlighting – samma princip som på adminsidan
    function setSelectedMarker(marker) {
      if (selectedMarker && selectedMarker !== marker) {
        try {
          if (selectedMarker._baseIcon) {
            selectedMarker.setIcon(selectedMarker._baseIcon);
          }
        } catch (e) {
          console.warn("Kunde inte återställa ikon för tidigare marker:", e);
        }
      }
  
      selectedMarker = marker || null;
  
      if (marker && window.google && google.maps && google.maps.Size) {
        const baseIcon = marker._baseIcon || ICON_REVIEWED;
        let bigIcon;
        if (typeof baseIcon === "string") {
          bigIcon = {
            url: baseIcon,
            scaledSize: new google.maps.Size(40, 40),
          };
        } else {
          bigIcon = Object.assign({}, baseIcon, {
            scaledSize: new google.maps.Size(40, 40),
          });
        }
        marker.setIcon(bigIcon);
      }
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
          activeId = r.id;
          renderList();
          scrollToCard(r.id);
  
          const distText =
            r.home_distance_km != null
              ? r.home_distance_km.toFixed(1) + " km från hem"
              : "";
          const ratingText = ratingStars(r.rating || 0);
  
          const html =
            "<strong>" +
            (r.place_name || "") +
            "</strong><br>" +
            (r.restaurant_type || "") +
            (ratingText ? "<br>" + ratingText : "") +
            (distText ? "<br>" + distText : "");
  
          infoWindow.setContent(html);
          infoWindow.open(map, marker);
  
          setSelectedMarker(marker);
          openOverlay(r);
        });
      });
  
      const bounds = boundsFromReviews(filteredReviews);
      if (bounds) {
        map.fitBounds(bounds);
      } else {
        map.setCenter({ lat: HOME_LAT, lng: HOME_LNG });
        map.setZoom(13);
      }
    }
  
    function scrollToCard(id) {
      const el = document.getElementById("rrp-card-" + id);
      if (!el) return;
      const wrapper = document.querySelector(
        "#restaurant-reviews-public .rrp-list-wrapper"
      );
      const top = el.offsetTop - 8;
      wrapper.scrollTo({ top, behavior: "smooth" });
    }
  
    function focusOnRestaurant(id) {
      const r = filteredReviews.find((x) => x.id === id);
      if (!r) return;
  
      const marker = markerById[id];
      if (marker) {
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
        filteredReviews = [...allReviews];
        applyFilters();
      } catch (e) {
        console.error(e);
        listEl.innerHTML =
          '<p class="rrp-muted">Kunde inte hämta restauranger just nu.</p>';
      }
    }
  
    function attachFilterEvents() {
      [
        "rrp-filter-search",
        "rrp-filter-cost",
        "rrp-filter-min-rating",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const evt = el.tagName === "INPUT" ? "input" : "change";
        el.addEventListener(evt, applyFilters);
      });
  
      const typeEl = document.getElementById("rrp-filter-type");
      if (typeEl) {
        typeEl.addEventListener("change", applyFilters);
      }
  
      document
        .getElementById("rrp-sort")
        .addEventListener("change", () => {
          applySort();
          renderList();
          renderMarkers();
        });
    }
  
    // OVERLAY LOGIK
    function initOverlay() {
      overlayEl = document.getElementById("rrp-overlay");
      overlayTitleEl = document.getElementById("rrp-overlay-title");
      overlayMetaEl = document.getElementById("rrp-overlay-meta");
      overlayRatingEl = document.getElementById("rrp-overlay-rating");
      overlayCommentEl = document.getElementById("rrp-overlay-comment");
      overlayImagesEl = document.getElementById("rrp-overlay-images");
      overlayDistanceEl = document.getElementById("rrp-overlay-distance");
      overlayDateEl = document.getElementById("rrp-overlay-date");
      overlayLinkEl = document.getElementById("rrp-overlay-link");
  
      const closeBtn = document.getElementById("rrp-overlay-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", closeOverlay);
      }
      if (overlayEl) {
        overlayEl.addEventListener("click", (e) => {
          if (e.target === overlayEl) closeOverlay();
        });
      }
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          if (galleryOverlayEl && galleryOverlayEl.style.display === "flex") {
            closeGallery();
          } else {
            closeOverlay();
          }
        }
      });
  
      const commentForm = document.getElementById("rrp-comment-form");
      if (commentForm) {
        commentForm.addEventListener("submit", onCommentSubmit);
      }
    }
  
    function openOverlay(r) {
      if (!overlayEl) return;
  
      currentOverlayReviewId = r.id;
  
      overlayTitleEl.textContent = r.place_name || "Okänd restaurang";
  
      const metaParts = [];
      if (r.restaurant_type) metaParts.push(r.restaurant_type);
      if (r.cost_level) metaParts.push(costToDollars(r.cost_level));
      if (r.value_rating)
        metaParts.push("Prisvärdhet " + r.value_rating + "/5");
      overlayMetaEl.textContent = metaParts.join(" • ");
  
      const stars = ratingStars(r.rating || 0);
      overlayRatingEl.innerHTML = stars
        ? `<div>${stars}</div><div style="font-size:0.8rem;opacity:0.75;">Helhetsbetyg ${r.rating}/5</div>`
        : "";
  
      const distText =
        r.home_distance_km != null
          ? r.home_distance_km.toFixed(1) + " km från Ugerupsgatan"
          : "";
      overlayDistanceEl.textContent = distText;
  
      // Viktigt: rendera HTML från Quill
      overlayCommentEl.innerHTML = r.comment || "";
  
      if (r.created_at) {
        overlayDateEl.textContent =
          "Recenserad: " +
          new Date(r.created_at).toLocaleDateString("sv-SE", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
      } else {
        overlayDateEl.textContent = "";
      }
  
      // Bilder + galleri
      overlayImagesEl.innerHTML = "";
      const urls = Array.isArray(r.image_urls) ? r.image_urls : [];
      if (urls.length) {
        urls.forEach((url, index) => {
          const thumb = document.createElement("div");
          thumb.className = "rrp-overlay-thumb";
          const img = document.createElement("img");
          img.src = url;
          img.alt = r.place_name || "Restaurangbild";
          img.loading = "lazy";
  
          thumb.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openGallery(urls, index);
          });
  
          thumb.appendChild(img);
          overlayImagesEl.appendChild(thumb);
        });
      } else {
        overlayImagesEl.innerHTML =
          '<p class="rrp-muted">Inga bilder tillagda ännu.</p>';
      }
  
      const gUrl = googleMapsUrl(r);
      overlayLinkEl.href = gUrl || "#";
  
      overlayEl.style.display = "flex";
  
      loadComments(r.id);
    }
  
    function closeOverlay() {
      if (!overlayEl) return;
      overlayEl.style.display = "none";
    }
  
    // GALLERI-LOGIK
    function initGalleryOverlay() {
      galleryOverlayEl = document.getElementById("rrp-gallery-overlay");
      galleryImgEl = document.getElementById("rrp-gallery-img");
      galleryPrevBtn = document.getElementById("rrp-gallery-prev");
      galleryNextBtn = document.getElementById("rrp-gallery-next");
      galleryCounterEl = document.getElementById("rrp-gallery-counter");
  
      const closeBtn = document.getElementById("rrp-gallery-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", closeGallery);
      }
      if (galleryOverlayEl) {
        galleryOverlayEl.addEventListener("click", (e) => {
          if (e.target === galleryOverlayEl) closeGallery();
        });
      }
      if (galleryPrevBtn) {
        galleryPrevBtn.addEventListener("click", showPrevImage);
      }
      if (galleryNextBtn) {
        galleryNextBtn.addEventListener("click", showNextImage);
      }
    }
  
    function openGallery(images, startIndex) {
      if (!galleryOverlayEl || !galleryImgEl) return;
      currentGalleryImages = images || [];
      currentGalleryIndex = startIndex || 0;
      if (!currentGalleryImages.length) return;
  
      updateGalleryImage();
      galleryOverlayEl.style.display = "flex";
    }
  
    function closeGallery() {
      if (!galleryOverlayEl) return;
      galleryOverlayEl.style.display = "none";
    }
  
    function updateGalleryImage() {
      if (!currentGalleryImages.length) {
        closeGallery();
        return;
      }
      const url = currentGalleryImages[currentGalleryIndex];
      galleryImgEl.src = url;
      galleryCounterEl.textContent =
        currentGalleryIndex + 1 + " / " + currentGalleryImages.length;
    }
  
    function showPrevImage() {
      if (!currentGalleryImages.length) return;
      currentGalleryIndex =
        (currentGalleryIndex - 1 + currentGalleryImages.length) %
        currentGalleryImages.length;
      updateGalleryImage();
    }
  
    function showNextImage() {
      if (!currentGalleryImages.length) return;
      currentGalleryIndex =
        (currentGalleryIndex + 1) % currentGalleryImages.length;
      updateGalleryImage();
    }
  
    // Kommentarer
    async function loadComments(reviewId) {
      const listEl = document.getElementById("rrp-comments-list");
      const statusEl = document.getElementById("rrp-comment-status");
      if (statusEl) statusEl.textContent = "";
  
      if (!listEl) return;
      listEl.innerHTML = '<p class="rrp-muted">Hämtar kommentarer...</p>';
  
      try {
        const res = await fetch(
          BACKEND_BASE_URL + "/api/comments?reviewId=" + encodeURIComponent(reviewId)
        );
        if (!res.ok) throw new Error("Failed to load comments");
        const data = await res.json();
        renderComments(data || []);
      } catch (err) {
        console.error("loadComments error:", err);
        listEl.innerHTML =
          '<p class="rrp-muted">Kunde inte hämta kommentarer just nu.</p>';
      }
    }
  
    function renderComments(comments) {
      const listEl = document.getElementById("rrp-comments-list");
      if (!listEl) return;
  
      listEl.innerHTML = "";
  
      if (!comments.length) {
        listEl.innerHTML = '<p class="rrp-muted">Inga kommentarer ännu.</p>';
        return;
      }
  
      comments.forEach((c) => {
        const item = document.createElement("div");
        item.className = "rrp-comment-item";
  
        const meta = document.createElement("div");
        meta.className = "rrp-comment-meta";
  
        const name = c.author_name || "Anonym";
        const dateText = c.created_at
          ? new Date(c.created_at).toLocaleDateString("sv-SE", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "";
  
        let statusLabel = "";
        if (c.status === "pending") {
          statusLabel = " • Väntar genomläsning";
        } else if (c.status === "rejected") {
          statusLabel = " • Ej publicerad";
        }
  
        meta.textContent = name + (dateText ? " • " + dateText : "") + statusLabel;
  
        const body = document.createElement("div");
        body.className = "rrp-comment-body";
        body.textContent = c.comment || "";
  
        item.appendChild(meta);
        item.appendChild(body);
  
        listEl.appendChild(item);
      });
    }
  
    async function onCommentSubmit(e) {
      e.preventDefault();
      if (!currentOverlayReviewId) return;
  
      const nameInput = document.getElementById("rrp-comment-name");
      const emailInput = document.getElementById("rrp-comment-email");
      const textInput = document.getElementById("rrp-comment-text");
      const statusEl = document.getElementById("rrp-comment-status");
      const submitBtn = document.getElementById("rrp-comment-submit");
  
      const authorName = nameInput.value.trim();
      const authorEmail = emailInput.value.trim();
      const comment = textInput.value.trim();
  
      if (!authorName || !comment) {
        statusEl.textContent = "Fyll i namn och kommentar.";
        return;
      }
  
      submitBtn.disabled = true;
      statusEl.textContent = "Skickar...";
  
      try {
        const res = await fetch(BACKEND_BASE_URL + "/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewId: currentOverlayReviewId,
            authorName,
            authorEmail: authorEmail || null,
            comment,
          }),
        });
  
        if (!res.ok) {
          throw new Error("Failed to post comment");
        }
  
        textInput.value = "";
        statusEl.textContent = "Tack! Din kommentar är publicerad.";
  
        await loadComments(currentOverlayReviewId);
      } catch (err) {
        console.error("onCommentSubmit error:", err);
        statusEl.textContent = "Kunde inte skicka kommentaren. Försök igen.";
      } finally {
        submitBtn.disabled = false;
      }
    }
  
    window.initRestaurantReviewsPublicMap = function () {
      const mapEl = document.getElementById("rrp-map");
      if (!mapEl) return;
  
      map = new google.maps.Map(mapEl, {
        center: { lat: HOME_LAT, lng: HOME_LNG },
        zoom: 13,
      });
  
      infoWindow = new google.maps.InfoWindow();
  
      attachFilterEvents();
      initOverlay();
      initGalleryOverlay();
      loadReviews();
    };
  })();
  
  // ⬇️ VIKTIGT: din kod måste definiera denna callback
  window.initRestaurantReviewsPublicMap = window.initRestaurantReviewsPublicMap || function () {
    console.error("[public] initRestaurantReviewsPublicMap is not defined yet.");
  };

  // Boot
  document.addEventListener("DOMContentLoaded", () => {
    renderShellOnce();
  
    // ✅ Kör allt som inte kräver karta
    // Exempel: loadReviews(); bindFilterHandlers(); bindOverlayHandlers();
    if (typeof initPublicUi === "function") {
      initPublicUi(); // du kan samla din “icke-karta”-init här
    }
  
    // ✅ Karta bara om nyckel finns
    const mapsKey = cfg.googleMapsApiKey;
    if (!mapsKey) {
      console.info("[public] Ingen googleMapsApiKey – kör utan karta (Pages-test).");
      return;
    }
  
    loadGoogleMaps({ apiKey: mapsKey, callbackName: "initRestaurantReviewsPublicMap" });
  });
})();