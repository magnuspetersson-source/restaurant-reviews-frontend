// app.js (public page) — Layout A (List | Map | Panel) with in-page panel
// Requires: RR_DOM, RR_STATE, RR_API, RR_MAP, RR_MARKERS, RR_LIST (or RR_UI_LIST), RR_UI_PANEL
// Optional: RR_UI_COMMENTS, RR_UI_MODAL

window.__RR_APP_VERSION__ = "app.js @ 2025-12-16 layout-A 3-col panel";

function ensureAppMarkup() {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app root");
  if (root.querySelector("#sortSelect")) {
    // If markup already exists, still ensure #resultsMeta is present
    if (!root.querySelector("#resultsMeta")) {
      const brand = root.querySelector(".brand");
      if (brand) {
        const meta = document.createElement("div");
        meta.className = "brand__sub";
        meta.id = "resultsMeta";
        meta.textContent = "…";
        brand.appendChild(meta);
      }
    }
    return;
  }

  root.innerHTML = `
    <div class="app">
      <header class="topbar">
        <div class="topbar__left">
          <div class="brand">
            <div class="brand__title">Recensioner</div>
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

            <div class="distanceToggle" role="group" aria-label="Avstånd">
              <span class="distanceLabel">Avstånd från:</span>
              <button id="distanceHomeBtn" type="button" class="control rr-toggle is-active" aria-pressed="true">Huset</button>
              <button id="distanceMeBtn" type="button" class="control rr-toggle" aria-pressed="false">Min position</button>
            </div>
          </div>

          <div class="mobileToggle" id="mobileToggle">
            <button class="toggleBtn is-active" data-mode="list" type="button">Lista</button>
            <button class="toggleBtn" data-mode="map" type="button">Karta</button>
          </div>
        </div>
      </header>

      <main class="main" id="mainGrid">
        <section class="col col--list" id="colList" aria-label="Lista">
          <div class="status" id="statusArea" hidden></div>
          <div class="list" id="reviewList" aria-label="Recensioner"></div>
        </section>

        <section class="col col--map" id="colMap" aria-label="Karta">
          <div class="map" id="map"></div>
          <div class="mapHint" id="mapHint" hidden></div>
        </section>

        <aside class="panel" id="reviewPanel" aria-label="Detaljer" aria-hidden="true">
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
                <div class="comments__disclaimer">Kommentarer är användargenererade och har inte granskats.</div>
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
    </div>
  `;
}

// Markers: rebuild only when list changes
let __RR_MARKERS_KEY = "";
let __RR_LIST_KEY = "";
let __RR_SELECTED_ID = null;
let __RR_PREV_OPEN = false;
let __RR_LAST_HIGHLIGHTED_ID = null;
let __RR_PANEL_RENDER_SCHEDULED = false;

function __rrMarkersKey(reviews) {
  return (reviews || []).map(r => `${r.id}:${r.restaurant_lat}:${r.restaurant_lng}`).join("|");
}

(function () {
  if (!window.RR_DOM || !window.RR_STATE) {
    console.error("[RR] Missing RR_DOM or RR_STATE");
    return;
  }

  const { qs, setHidden } = window.RR_DOM;
  const { actions, state, subscribe } = window.RR_STATE;
  const selectors = window.RR_STATE.selectors || null;

  // ---------------- Distance mode: "Vi äter oss ur huset" ----------------
  let __distanceMode = "home"; // "home" | "me"
  let __userPos = null;

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function getUserPosOnce() {
    if (__userPos) return Promise.resolve(__userPos);
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation stöds inte"));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          __userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          resolve(__userPos);
        },
        () => reject(new Error("Platsåtkomst nekades")),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  function setDistanceMode(mode) {
    __distanceMode = mode === "me" ? "me" : "home";
    const homeBtn = document.getElementById("distanceHomeBtn");
    const meBtn = document.getElementById("distanceMeBtn");

    if (homeBtn) {
      const on = __distanceMode === "home";
      homeBtn.classList.toggle("is-active", on);
      homeBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (meBtn) {
      const on = __distanceMode === "me";
      meBtn.classList.toggle("is-active", on);
      meBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  // --- Squarespace header offset (mobile panel must start below site header) ---
  function updateSquarespaceHeaderOffset() {
    const root = document.getElementById("app");
    if (!root) return;
  
    const header =
      document.querySelector("header.Header") ||
      document.querySelector(".Header") ||
      document.querySelector("#header") ||
      document.querySelector("header");
  
    const h = header
      ? Math.max(0, Math.round(header.getBoundingClientRect().height))
      : 0;
  
    // Expose to CSS
    root.style.setProperty("--rr-header-offset", `${h}px`);
  }

  // ---------------- Helpers ----------------
  function isReviewed(r) {
    const hasText = !!(r?.comment && String(r.comment).trim());
    const hasRating = r?.rating != null && Number.isFinite(Number(r.rating));
    return hasText || hasRating;
  }

  function getReviewSortTime(r) {
    const d = r?.review_date || r?.created_at;
    const t = d ? Date.parse(d) : NaN;
    return Number.isFinite(t) ? t : 0;
  }

  function getReviewByIdSafe(s, id) {
    const num = (id === null || id === undefined || id === "") ? null : Number(id);
    if (!Number.isFinite(num)) return null;

    const byId = s?.data?.byId;
    if (byId && (byId[num] || byId[String(num)])) return byId[num] || byId[String(num)];

    const reviews = Array.isArray(s?.data?.reviews) ? s.data.reviews : [];
    return reviews.find((r) => String(r.id) === String(num)) || null;
  }

  function getListForRender(s) {
    let arr;
    if (selectors && typeof selectors.getFilteredSortedReviews === "function") {
      arr = selectors.getFilteredSortedReviews();
    } else {
      arr = Array.isArray(s?.data?.reviews) ? s.data.reviews : [];
    }
    return (arr || []).filter(isReviewed);
  }

  function withDistance(list) {
    return (list || []).map((r) => {
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
          km = haversineKm(__userPos.lat, __userPos.lng, lat, lng);
        }
      }

      if (!Number.isFinite(km)) {
        const h = Number(r.home_distance_km);
        km = Number.isFinite(h) ? h : null;
      }

      return { ...r, _distance_km: Number.isFinite(km) ? km : null };
    });
  }

  async function selectReview(id, source) {
    actions.selectReview(id, source);
    if (id != null && window.RR_UI_COMMENTS?.loadComments) {
      try { await window.RR_UI_COMMENTS.loadComments(id); }
      catch (e) { console.warn("[RR] loadComments failed", e); }
    }
  }

  // ---------------- Comments POST ----------------
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
        comment: body,
      }),
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

  // ---------------- Slideshow fallback ----------------
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
  function ssPrev() { if (__SS.images.length) { __SS.index = (__SS.index - 1 + __SS.images.length) % __SS.images.length; ssRender(); } }
  function ssNext() { if (__SS.images.length) { __SS.index = (__SS.index + 1) % __SS.images.length; ssRender(); } }

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
      if (e.key === "Escape" && __SS.open) ssClose();
    });
  }

  // ---------------- Wiring ----------------
  function wireTopbar() {
    qs("#sortSelect")?.addEventListener("change", (e) => actions.setSort(e.target.value));
    qs("#typeSelect")?.addEventListener("change", (e) => actions.setFilter("type", e.target.value));
    qs("#priceSelect")?.addEventListener("change", (e) => actions.setFilter("price", e.target.value));
    qs("#minRatingSelect")?.addEventListener("change", (e) => actions.setFilter("minRating", e.target.value));

    const homeBtn = document.getElementById("distanceHomeBtn");
    const meBtn = document.getElementById("distanceMeBtn");

    homeBtn?.addEventListener("click", () => {
      setDistanceMode("home");
      render(window.RR_STATE.state);
    });

    meBtn?.addEventListener("click", async () => {
      setDistanceMode("me");
      try {
        await getUserPosOnce();
        render(window.RR_STATE.state);
      } catch (err) {
        console.warn("[RR] Geolocation failed:", err);
        setDistanceMode("home");
        render(window.RR_STATE.state);
      }
    });
  }

  // Close is delegated (capture) so it always works even if DOM moves
  function wirePanelClose() {
    document.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest("#panelCloseBtn");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        selectReview(null, "ui");
      },
      true
    );
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

  function applyMobileMode(viewMode, hasPanel) {
    const isMobile = window.matchMedia("(max-width: 980px)").matches;
    const colList = qs("#colList");
    const colMap = qs("#colMap");
    const toggle = qs("#mobileToggle");

    // When panel is open on mobile, CSS will hide list/map and show panel.
    // We keep toggle state, but avoid fighting the CSS.
    if (!isMobile) {
      colMap.style.display = "";
      colList.style.display = "";
      toggle?.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
      return;
    }

    toggle?.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("is-active", b.getAttribute("data-mode") === (viewMode || "list"))
    );

    if (hasPanel) return;

    if ((viewMode || "list") === "map") {
      colMap.style.display = "block";
      colList.style.display = "none";
    } else {
      colMap.style.display = "none";
      colList.style.display = "block";
    }
  }

  // ---------------- Data load ----------------
  async function loadReviewsOnce() {
    const statusArea = qs("#statusArea");
    statusArea.textContent = "Laddar recensioner…";
    setHidden(statusArea, false);
    // Also reflect loading state in the top meta (so users don't only see "Laddar…" forever)
    qs("#resultsMeta") && (qs("#resultsMeta").textContent = "Laddar…");

    try {
      const reviews = await window.RR_API.getReviews();
      actions.setReviews(reviews);
      
      // Update top meta immediately (don’t rely on render timing)
      const reviewedCount = (reviews || []).filter(isReviewed).length;
      const meta = qs("#resultsMeta");
    if (meta) meta.textContent = `${reviewedCount} recensioner`;

      // Populate "Typ" from existing reviewed reviews
      try {
        const typeSel = document.getElementById("typeSelect");
        if (typeSel) {
          const reviewed = (reviews || []).filter(r => (r?.comment && String(r.comment).trim()) || (r?.rating != null));
          const types = Array.from(
            new Set(
              reviewed
                .map(r => (r?.restaurant_type || "").trim())
                .filter(Boolean)
            )
          ).sort((a, b) => a.localeCompare(b, "sv"));
      
          // rebuild options (keep first "Alla")
          typeSel.innerHTML = `<option value="">Typ: Alla</option>` +
            types.map(t => `<option value="${t}">${t}</option>`).join("");
        }
      } catch (e) {
        console.warn("[RR] render type options failed", e);
      }

      setHidden(statusArea, true);
    } catch (e) {
      const msg = e?.message || "Kunde inte hämta recensioner";
      statusArea.textContent = `Fel: ${msg}`;
      setHidden(statusArea, false);
      console.error("[RR] loadReviewsOnce failed:", e);
    }
  }

  function ensureMapVisible() {
    if (!window.RR_MAP?.getMap) return;
    const map = window.RR_MAP.getMap();
    if (!map || !window.google?.maps?.event) return;
  
    // Kör i nästa frame så layouten är klar
    requestAnimationFrame(() => {
      google.maps.event.trigger(map, "resize");
    });
  }

  // ---------------- Render ----------------
  function render(s) {
    const mqMobile = window.matchMedia("(max-width: 980px)");
    const isMobile = mqMobile.matches;
    const list = getListForRender(s);
    const listWithDistance = withDistance(list);

	// List
    const selectedId = s?.ui?.selectedReviewId ?? null;
    
    // list key (id + sort/filter-effekter + distance mode + ev userpos)
    const listKey = listWithDistance.map(r => `${r.id}:${r._distance_km ?? ""}`).join("|");
    
    const listUI = window.RR_UI_LIST || window.RR_LIST;
    
    if (listKey !== __RR_LIST_KEY) {
      __RR_LIST_KEY = listKey;
      listUI?.renderList?.(listWithDistance, selectedId, (id, source) => selectReview(id, source || "list"));
    } else if (selectedId !== __RR_SELECTED_ID) {
      // om din list-komponent stödjer “highlight” utan full rerender (om den finns)
      listUI?.highlightSelected?.(selectedId);
    }
    
    __RR_SELECTED_ID = selectedId;

    // Review lookup
    const id = s?.ui?.selectedReviewId;
    const wasOpen = __RR_PREV_OPEN;
    const review =
      getReviewByIdSafe(s, id) ||
      (s?.data?.byId ? (s.data.byId[id] || s.data.byId[String(id)]) : null) ||
      (Array.isArray(s?.data?.reviews) ? s.data.reviews.find(r => String(r.id) === String(id)) : null) ||
      null;

    const open = !!review;
    
    // Ensure selected review has _distance_km for panel (same as list)
    let reviewForPanel = review;
    
    if (open && review) {
      const mode = (typeof __distanceMode === "string") ? __distanceMode : "home";
    
      // label used by panel.js
      window.RR_DISTANCE_LABEL = (mode === "me") ? "från Min position" : "från Huset";
    
      // compute distance (match your list logic)
      let km = null;
    
      if (mode === "me" && __userPos && review.restaurant_lat != null && review.restaurant_lng != null) {
        const lat = Number(review.restaurant_lat);
        const lng = Number(review.restaurant_lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          km = haversineKm(__userPos.lat, __userPos.lng, lat, lng);
        }
      }
    
      if (!Number.isFinite(km)) {
        const h = Number(review.home_distance_km);
        km = Number.isFinite(h) ? h : null;
      }
    
      reviewForPanel = { ...review, _distance_km: Number.isFinite(km) ? km : null };
    }    

    // Panel visibility
    const panelEl = document.getElementById("reviewPanel");
    if (panelEl) {
      panelEl.setAttribute("aria-hidden", open ? "false" : "true");
      panelEl.classList.toggle("is-open", open);

      // In-page layout A: toggle third column on main grid
      const mainEl = document.getElementById("mainGrid") || document.querySelector("#app .main");
      if (mainEl) mainEl.classList.toggle("has-panel", open);

      // Render content AFTER visibility set (and never crash render loop)
      if (open) {
        // Defer heavy DOM work to next frame to keep INP low
        if (!__RR_PANEL_RENDER_SCHEDULED) {
          __RR_PANEL_RENDER_SCHEDULED = true;
          requestAnimationFrame(() => {
            __RR_PANEL_RENDER_SCHEDULED = false;
            try { window.RR_UI_PANEL?.renderPanel?.(reviewForPanel); }
            catch (e) { console.error("[RR] RR_UI_PANEL.renderPanel crashed:", e); }
          });
        }
      }
    }
    
    // Mobile (do this early so close paints ASAP)
    applyMobileMode(s.ui.viewMode || "list", open);
    
    // If map just became visible, force Google Maps resize
    if (!open && (!isMobile || s.ui.viewMode === "map")) {
      ensureMapVisible();
    }

    // Markers (rebuild only when list changes)
    if (window.RR_MAP?.getMap?.() && window.google && google.maps && window.RR_MARKERS?.renderMarkers) {
      const key = __rrMarkersKey(listWithDistance);
      if (key !== __RR_MARKERS_KEY) {
        __RR_MARKERS_KEY = key;
        window.RR_MARKERS.renderMarkers(listWithDistance, null, (id) => selectReview(id, "map"));
      }

      const nextId = s?.ui?.selectedReviewId ?? null;

      // ✅ INP-fix: när vi stänger panelen, skjut highlight-reset till nästa frame
      if (wasOpen && !open) {
        requestAnimationFrame(() => {
          try { window.RR_MARKERS.highlightSelected?.(null); } catch {}
          __RR_LAST_HIGHLIGHTED_ID = null;
        });
      } else if (nextId !== __RR_LAST_HIGHLIGHTED_ID) {
        // Diffad highlight: uppdatera bara vid byte
        if (__RR_LAST_HIGHLIGHTED_ID != null) {
          try {
            // Om highlightSelected stödjer (nextId, prevId) går det snabbare,
            // annars fall back till highlightSelected(null).
            window.RR_MARKERS.highlightSelected?.(null, __RR_LAST_HIGHLIGHTED_ID);
          } catch {
            try { window.RR_MARKERS.highlightSelected?.(null); } catch {}
          }
        }

        if (nextId != null) {
          try { window.RR_MARKERS.highlightSelected?.(nextId); } catch {}
        }

        __RR_LAST_HIGHLIGHTED_ID = nextId;
      }
    }

    /* ✅ LÄGG IN HÄR: comments render */
    if (open && window.RR_UI_COMMENTS?.renderComments) {
      const rid = s?.ui?.selectedReviewId;
      const data = s?.data || {};
    
      const comments =
        (data.commentsByReviewId && (data.commentsByReviewId[rid] || data.commentsByReviewId[String(rid)])) ||
        (data.comments && (data.comments[rid] || data.comments[String(rid)])) ||
        (Array.isArray(data.comments) ? data.comments : []) ||
        [];

      // Defer comments too (often lots of nodes)
      requestAnimationFrame(() => {
        window.RR_UI_COMMENTS.renderComments(comments);
      });
    }

    // Slideshow images for fallback
    const gallery = qs("#panelGallery");
    if (gallery) {
      const imgs = Array.isArray(review?.images) ? review.images : [];
      gallery.dataset.images = JSON.stringify(imgs);
    }

	__RR_PREV_OPEN = open;
  }

  // ---------------- Init ----------------
  async function init() {
    ensureAppMarkup();
    // Make sure panel never hides behind Squarespace header (esp. on mobile)
    updateSquarespaceHeaderOffset();
    window.addEventListener("resize", updateSquarespaceHeaderOffset, { passive: true });
    window.addEventListener("orientationchange", updateSquarespaceHeaderOffset, { passive: true });
    // If Squarespace does late layout, re-check after a tick too
    setTimeout(updateSquarespaceHeaderOffset, 250);
    setTimeout(updateSquarespaceHeaderOffset, 1200);

    wireTopbar();
    wirePanelClose();
    wireMobileToggle();
    wireCommentForm();
    wireSlideshowFallback();

    window.RR_UI_MODAL?.wireModal?.();

    subscribe(render);

    const mapEl = qs("#map");
    try {
      if (window.RR_CONFIG_READY) await window.RR_CONFIG_READY;
      await window.RR_MAP.initMap(mapEl);
    } catch (e) {
      const hint = qs("#mapHint");
      if (hint) {
        hint.textContent = e?.message || "Kunde inte initiera karta";
        setHidden(hint, false);
      }
    }

    await loadReviewsOnce();

    const initialId = window.RR_ROUTER?.getSelectedId?.();
    const initialReview = getReviewByIdSafe(window.RR_STATE.state, initialId);
    if (initialReview) await selectReview(initialReview.id, "router");

    // Close on Escape
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (window.RR_STATE?.state?.ui?.selectedReviewId != null) selectReview(null, "escape");
      if (__SS.open) ssClose();
    });

    render(window.RR_STATE.state);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();