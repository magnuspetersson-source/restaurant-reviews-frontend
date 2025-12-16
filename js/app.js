// app.js (public page)

function ensureAppMarkup() {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app root");

  // IMPORTANT: only check inside #app, not the whole document
  if (root.querySelector("#sortSelect")) return;

  root.innerHTML = `
    <header class="topbar">
      <div class="topbar__left">
        <div class="brand">
          <div class="brand__title">Restaurant Reviews</div>
          <div class="brand__sub" id="resultsMeta">Laddar…</div>
        </div>
      </div>

      <div class="topbar__right">
        <div class="controls">
          <select id="sortSelect" class="control">
            <option value="latest">Sortera: Senaste</option>
            <option value="rating_desc">Sortera: Högst betyg</option>
            <option value="value_desc">Sortera: Bäst value</option>
            <option value="distance_asc">Sortera: Närmast</option>
          </select>

          <select id="typeSelect" class="control">
            <option value="">Typ: Alla</option>
          </select>

          <select id="priceSelect" class="control">
            <option value="">Pris: Alla</option>
            <option value="1">$</option>
            <option value="2">$$</option>
            <option value="3">$$$</option>
            <option value="4">$$$$</option>
            <option value="5">$$$$$</option>
          </select>

          <select id="minRatingSelect" class="control">
            <option value="">Betyg: Alla</option>
            <option value="5">★★★★★</option>
            <option value="4">★★★★+</option>
            <option value="3">★★★+</option>
            <option value="2">★★+</option>
            <option value="1">★+</option>
          </select>

          <!-- Distance toggle INSIDE .controls so it's not lost/styled weirdly -->
          <div class="distanceToggle" role="group" aria-label="Avstånd">
            <button
              id="distanceHomeBtn"
              type="button"
              class="control rr-toggle is-active"
              aria-pressed="true"
            >Huset</button>

            <button
              id="distanceMeBtn"
              type="button"
              class="control rr-toggle"
              aria-pressed="false"
            >Min position</button>
          </div>
        </div>

        <div class="mobileToggle" id="mobileToggle">
          <button class="toggleBtn is-active" data-mode="list" type="button">Lista</button>
          <button class="toggleBtn" data-mode="map" type="button">Karta</button>
        </div>
      </div>
    </header>

    <main class="main">
      <section class="col col--list" id="colList" aria-label="Lista">
        <div class="status" id="statusArea" hidden></div>
        <div class="list" id="reviewList" aria-label="Recensioner"></div>
      </section>

      <section class="col col--map" id="colMap" aria-label="Karta">
        <div class="map" id="map"></div>
        <div class="mapHint" id="mapHint" hidden></div>
      </section>

      <aside class="panel" id="reviewPanel" aria-label="Detaljer" aria-hidden="true" style="display:none">
        <div class="panel__header">
          <button class="iconBtn" id="panelCloseBtn" aria-label="Stäng" type="button">✕</button>
          <div class="panel__title" id="panelTitle"></div>
          <div class="panel__meta" id="panelMeta"></div>
        </div>

        <div class="panel__body">
          <div class="gallery" id="panelGallery"></div>
          <div class="content" id="panelContent"></div>

          <div class="comments">
            <div class="comments__header">
              <div class="comments__title">Kommentarer</div>
              <div class="comments__disclaimer">
                Kommentarer är användargenererade och har inte granskats.
              </div>
            </div>

            <div class="comments__list" id="commentsList"></div>

            <form class="commentForm" id="commentForm">
              <div class="row">
                <label class="field">
                  <span>Namn</span>
                  <input type="text" id="commentName" required maxlength="80" />
                </label>
                <label class="field">
                  <span>Email (valfritt)</span>
                  <input type="email" id="commentEmail" maxlength="120" />
                </label>
              </div>

              <label class="field">
                <span>Kommentar</span>
                <textarea id="commentBody" required maxlength="2000"></textarea>
              </label>

              <div class="commentForm__actions">
                <button type="submit" class="btn" id="commentSubmitBtn">Skicka</button>
                <div class="formNote" id="commentNote"></div>
              </div>
            </form>
          </div>
        </div>
      </aside>
    </main>

    <div class="modal" id="slideshowModal" aria-hidden="true">
      <div class="modal__overlay" id="modalOverlay"></div>
      <div class="modal__dialog" role="dialog" aria-modal="true" aria-label="Bildspel">
        <button class="iconBtn modal__close" id="modalCloseBtn" aria-label="Stäng" type="button">✕</button>

        <div class="modal__media">
          <button class="navBtn" id="modalPrevBtn" aria-label="Föregående" type="button">‹</button>
          <img id="modalImage" alt="" />
          <button class="navBtn" id="modalNextBtn" aria-label="Nästa" type="button">›</button>
        </div>

        <div class="modal__caption" id="modalCaption"></div>
        <div class="modal__counter" id="modalCounter"></div>
      </div>
    </div>
  `;
}

(function () {
  const { qs, setHidden } = window.RR_DOM;
  const { actions, state, subscribe } = window.RR_STATE;
  const selectors = window.RR_STATE.selectors || null;

  // --- Distance mode: "Vi äter oss ur huset"
  let __distanceMode = "home"; // "home" | "me"
  let __userPos = null;

  function __haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function __getUserPosOnce() {
    if (__userPos) return Promise.resolve(__userPos);

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation stöds inte"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          __userPos = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          resolve(__userPos);
        },
        () => reject(new Error("Platsåtkomst nekades")),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  function __setDistanceMode(mode) {
    __distanceMode = mode === "me" ? "me" : "home";

    const homeBtn = document.getElementById("distanceHomeBtn");
    const meBtn = document.getElementById("distanceMeBtn");

    if (homeBtn) {
      homeBtn.classList.toggle("is-active", __distanceMode === "home");
      homeBtn.setAttribute("aria-pressed", __distanceMode === "home" ? "true" : "false");
    }
    if (meBtn) {
      meBtn.classList.toggle("is-active", __distanceMode === "me");
      meBtn.setAttribute("aria-pressed", __distanceMode === "me" ? "true" : "false");
    }
  }

  // --- Safe wrappers (so we never depend on optional net actions)
  function setNetLoadingSafe(key, val) {
    if (typeof actions.setNetLoading === "function") actions.setNetLoading(key, val);
  }
  function setNetErrorSafe(key, val) {
    if (typeof actions.setNetError === "function") actions.setNetError(key, val);
  }

  // --- Helpers
  function isReviewed(r) {
    // "Visa bara recenserade" — robust fallback:
    // if comment/review HTML exists OR rating exists, treat as reviewed
    const hasText = !!(r?.comment && String(r.comment).trim());
    const hasRating = r?.rating != null && Number.isFinite(Number(r.rating));
    return hasText || hasRating;
  }

  function getReviewByIdSafe(s, id) {
    const num = (id === null || id === undefined || id === "") ? null : Number(id);
    if (!Number.isFinite(num)) return null;

    const byId = s?.data?.byId;
    if (byId && byId[num]) return byId[num];

    const reviews = Array.isArray(s?.data?.reviews) ? s.data.reviews : [];
    return reviews.find(r => Number(r.id) === num) || null;
  }

  function getListForRender(s) {
    let arr;
    if (selectors && typeof selectors.getFilteredSortedReviews === "function") {
      arr = selectors.getFilteredSortedReviews();
    } else {
      arr = Array.isArray(s?.data?.reviews) ? s.data.reviews : [];
    }
    // enforce scope: reviewed only
    return (arr || []).filter(isReviewed);
  }

  async function postComment(reviewId) {
    const apiBase = ((window.RR_PUBLIC_CONFIG?.apiBase || window.RR_CONFIG?.apiBase || "") + "").replace(/\/+$/, "");
    if (!apiBase) throw new Error("Saknar apiBase");

    const rid = Number(reviewId);
    if (!Number.isFinite(rid)) throw new Error("Saknar reviewId");

    const name = qs("#commentName")?.value?.trim() || "";
    const email = qs("#commentEmail")?.value?.trim() || "";
    const body = qs("#commentBody")?.value?.trim() || "";

    if (!name) throw new Error("Namn krävs");
    if (!body) throw new Error("Kommentar krävs");

    const res = await fetch(`${apiBase}/api/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId: rid,
        authorName: name,
        authorEmail: email ? email : null,
        comment: body
      })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Upload failed: HTTP ${res.status} ${txt}`.trim());
    }
    return await res.json();
  }

  function wireCommentForm() {
    const form = qs("#commentForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const note = qs("#commentNote");
      const btn = qs("#commentSubmitBtn");
      const reviewId = window.RR_STATE?.state?.ui?.selectedReviewId;

      try {
        if (btn) btn.disabled = true;
        if (note) note.textContent = "Skickar…";

        await postComment(reviewId);

        const body = qs("#commentBody");
        if (body) body.value = "";

        if (window.RR_UI_COMMENTS?.loadComments) {
          await window.RR_UI_COMMENTS.loadComments(reviewId);
        }

        if (note) note.textContent = "Tack! Din kommentar är skickad. (Ej granskad)";
      } catch (err) {
        console.error("[RR] comment submit failed", err);
        if (note) note.textContent = err?.message || "Kunde inte skicka kommentar";
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  // --- Slideshow fallback
  let __SS = { open: false, images: [], index: 0 };

  function getGalleryImagesFromDOM() {
    const g = qs("#panelGallery");
    if (!g) return [];
    try {
      const arr = JSON.parse(g.dataset.images || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function ssRender() {
    const modal = qs("#slideshowModal");
    if (!modal) return;

    modal.setAttribute("aria-hidden", __SS.open ? "false" : "true");
    modal.classList.toggle("is-open", __SS.open);
    if (!__SS.open) return;

    const current = __SS.images[__SS.index] || {};
    const img = qs("#modalImage");
    const cap = qs("#modalCaption");
    const ctr = qs("#modalCounter");

    if (img) img.src = current.url || "";
    if (cap) cap.textContent = current.caption || "";
    if (ctr) ctr.textContent = `${__SS.index + 1} / ${__SS.images.length}`;
  }

  function ssOpen(startIndex = 0) {
    __SS.images = getGalleryImagesFromDOM();
    if (!__SS.images.length) return;
    __SS.index = Math.max(0, Math.min(__SS.images.length - 1, Number(startIndex) || 0));
    __SS.open = true;
    ssRender();
  }

  function ssClose() { __SS.open = false; ssRender(); }
  function ssPrev() {
    if (!__SS.images.length) return;
    __SS.index = (__SS.index - 1 + __SS.images.length) % __SS.images.length;
    ssRender();
  }
  function ssNext() {
    if (!__SS.images.length) return;
    __SS.index = (__SS.index + 1) % __SS.images.length;
    ssRender();
  }

  function wireSlideshowFallback() {
    qs("#panelGallery")?.addEventListener("click", (e) => {
      const t = e.target.closest("[data-index], img, button, a, div");
      if (!t) return;
      const idx = t.getAttribute("data-index");
      ssOpen(idx != null ? Number(idx) : 0);
    });

    qs("#modalOverlay")?.addEventListener("click", ssClose);
    qs("#modalCloseBtn")?.addEventListener("click", ssClose);
    qs("#modalPrevBtn")?.addEventListener("click", ssPrev);
    qs("#modalNextBtn")?.addEventListener("click", ssNext);

    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (__SS.open) ssClose();
    });
  }

  // --- Wiring
  function wireTopbar() {
    qs("#sortSelect")?.addEventListener("change", (e) => actions.setSort(e.target.value));
    qs("#typeSelect")?.addEventListener("change", (e) => actions.setFilter("type", e.target.value));
    qs("#priceSelect")?.addEventListener("change", (e) => actions.setFilter("price", e.target.value));
    qs("#minRatingSelect")?.addEventListener("change", (e) => actions.setFilter("minRating", e.target.value));

    const homeBtn = document.getElementById("distanceHomeBtn");
    const meBtn = document.getElementById("distanceMeBtn");

    homeBtn?.addEventListener("click", () => {
      __setDistanceMode("home");
      render(state);
    });

    meBtn?.addEventListener("click", async () => {
      __setDistanceMode("me");
      try {
        await __getUserPosOnce();
        render(state);
      } catch (err) {
        console.warn("[RR] Geolocation failed:", err);
        __setDistanceMode("home");
        render(state);
      }
    });
  }

  function wirePanelClose() {

    qs("#panelCloseBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      actions.selectReview(null, "ui");
    });
  }

  function wireMobileToggle() {
    const toggle = qs("#mobileToggle");
    if (!toggle) return;
    toggle.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-mode]");
      if (!btn) return;
      actions.setViewMode(btn.getAttribute("data-mode"));
    });
  }

  function applyMobileMode(viewMode) {
    const isMobile = window.matchMedia("(max-width: 980px)").matches;
    const colList = qs("#colList");
    const colMap = qs("#colMap");
    const toggle = qs("#mobileToggle");

    if (!isMobile) {
      colMap.style.display = "";
      colList.style.display = "";
      toggle?.querySelectorAll("button").forEach(b => b.classList.remove("is-active"));
      return;
    }

    toggle?.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("is-active", b.getAttribute("data-mode") === viewMode)
    );

    if (viewMode === "map") {
      colMap.style.display = "block";
      colList.style.display = "none";
    } else {
      colMap.style.display = "none";
      colList.style.display = "block";
    }
  }

  // --- Data load
  async function loadReviewsOnce() {
    setNetLoadingSafe("reviews", true);
    setNetErrorSafe("reviews", null);

    const statusArea = qs("#statusArea");
    statusArea.textContent = "Laddar recensioner…";
    setHidden(statusArea, false);

    try {
      const reviews = await window.RR_API.getReviews();
      actions.setReviews(reviews);

      try { window.RR_UI_LIST?.renderTypeOptions?.(reviews); } catch {}

      setHidden(statusArea, true);
    } catch (e) {
      const msg = e?.message || "Kunde inte hämta recensioner";
      setNetErrorSafe("reviews", msg);
      statusArea.textContent = `Fel: ${msg}`;
      setHidden(statusArea, false);
      console.error("[RR] loadReviewsOnce failed:", e);
    } finally {
      setNetLoadingSafe("reviews", false);
    }
  }

  // --- Render
  function render(s) {
    const list = getListForRender(s);

    // Distance: inject _distance_km based on mode
    const listWithDistance = (list || []).map((r) => {
      let km = null;

      if (
        __distanceMode === "me" &&
        __userPos &&
        r.restaurant_lat != null &&
        r.restaurant_lng != null
      ) {
        const lat = Number(r.restaurant_lat);
        const lng = Number(r.restaurant_lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          km = __haversineKm(__userPos.lat, __userPos.lng, lat, lng);
        }
      }

      if (!Number.isFinite(km)) {
        const h = Number(r.home_distance_km);
        km = Number.isFinite(h) ? h : null;
      }

      return { ...r, _distance_km: Number.isFinite(km) ? km : null };
    });

    // List (stars + date + type/price/distance is handled by list.js)
    const listUI = window.RR_UI_LIST || window.RR_LIST;
    if (listUI?.renderList) {
      listUI.renderList(listWithDistance, s.ui.selectedReviewId, (id, source) =>
        actions.selectReview(id, source || "list")
      );
    }

    // Markers (default red pins + InfoWindow handled by markers.js)
    if (window.RR_MAP?.getMap?.() && window.google && google.maps && window.RR_MARKERS?.renderMarkers) {
      // IMPORTANT: call every render so InfoWindow/meta updates when distance mode changes
      window.RR_MARKERS.renderMarkers(listWithDistance, null, (id) => actions.selectReview(id, "map"));
      window.RR_MARKERS.highlightSelected?.(s.ui.selectedReviewId);
    }

    // Panel content
    const review = getReviewByIdSafe(s, s.ui.selectedReviewId);
    const panelEl = qs("#reviewPanel");
    
    if (!review) {
      // HARD CLOSE – renderPanel får ALDRIG null
      if (panelEl) {
        panelEl.setAttribute("aria-hidden", "true");
        panelEl.style.display = "none";
      }
    } else {
      window.RR_UI_PANEL?.renderPanel?.(review);
      if (panelEl) {
        panelEl.setAttribute("aria-hidden", "false");
        panelEl.style.display = "block";
      }
    }
    
    // Slideshow images for fallback
    const gallery = qs("#panelGallery");
    if (gallery) {
      const imgs = Array.isArray(review?.images) ? review.images : [];
      gallery.dataset.images = JSON.stringify(imgs);
    }

    // Meta
    const meta = qs("#resultsMeta");
    if (meta) meta.textContent = `${list.length} recensioner`;

    // Mobile
    applyMobileMode(s.ui.viewMode || "list");
  }

  // --- Init
  async function init() {
    ensureAppMarkup();

    // sanity check: distance buttons must exist after markup
    // (this also helps you debug quickly if Squarespace injects multiple scripts)
    if (!document.getElementById("distanceHomeBtn")) {
      console.warn("[RR] distance buttons missing after ensureAppMarkup()");
    }

    wireTopbar();
    wirePanelClose();
    wireMobileToggle();
    wireCommentForm();
    wireSlideshowFallback();

    // Modal (if you have a separate module)
    window.RR_UI_MODAL?.wireModal?.();

    subscribe(render);

    const mapEl = qs("#map");
    try {
      if (window.RR_CONFIG_READY) await window.RR_CONFIG_READY;
      await window.RR_MAP.initMap(mapEl);
    } catch (e) {
      const hint = qs("#mapHint");
      if (hint) {
        hint.textContent = e.message || "Kunde inte initiera karta";
        setHidden(hint, false);
      }
    }

    await loadReviewsOnce();

    // initial selection from URL
    const initialId = window.RR_ROUTER?.getSelectedId?.();
    const initialReview = getReviewByIdSafe(state, initialId);
    if (initialReview) {
      actions.selectReview(initialReview.id, "router");
      await window.RR_UI_COMMENTS?.loadComments?.(initialReview.id);
    }

    // Close on Escape
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (window.RR_STATE?.state?.ui?.selectedReviewId != null) actions.selectReview(null, "escape");
      if (__SS.open) ssClose();
    });

    render(state);
  }

  // Squarespace sometimes loads scripts after DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();