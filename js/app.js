function ensureAppMarkup() {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app root");
  if (document.getElementById("sortSelect")) return;

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

// Markers: rebuild only when list changes
let __RR_MARKERS_KEY = "";
function __rrMarkersKey(reviews) {
  return (reviews || []).map(r => `${r.id}:${r.restaurant_lat}:${r.restaurant_lng}`).join("|");
}

(function () {
  const { qs, setHidden } = window.RR_DOM;
  const { actions, state, subscribe } = window.RR_STATE;
  const selectors = window.RR_STATE.selectors || null;

  // --- Safe wrappers (so we never depend on optional net actions) ---
  function setNetLoadingSafe(key, val) {
    if (typeof actions.setNetLoading === "function") actions.setNetLoading(key, val);
  }
  function setNetErrorSafe(key, val) {
    if (typeof actions.setNetError === "function") actions.setNetError(key, val);
  }

  // --- Helpers ---
  function getReviewByIdSafe(s, id) {
    const num = (id === null || id === undefined || id === "") ? null : Number(id);
    if (!Number.isFinite(num)) return null;
    const byId = s?.data?.byId;
    if (byId && byId[num]) return byId[num];
    const reviews = Array.isArray(s?.data?.reviews) ? s.data.reviews : [];
    return reviews.find(r => Number(r.id) === num) || null;
  }

  function getListForRender(s) {
    if (selectors && typeof selectors.getFilteredSortedReviews === "function") {
      return selectors.getFilteredSortedReviews();
    }
    return Array.isArray(s?.data?.reviews) ? s.data.reviews : [];
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

  // --- Slideshow fallback ---
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

  // --- Wiring ---
  function wireTopbar() {
    qs("#sortSelect")?.addEventListener("change", (e) => actions.setSort(e.target.value));
    qs("#typeSelect")?.addEventListener("change", (e) => actions.setFilter("type", e.target.value));
    qs("#priceSelect")?.addEventListener("change", (e) => actions.setFilter("price", e.target.value));
    qs("#minRatingSelect")?.addEventListener("change", (e) => actions.setFilter("minRating", e.target.value));
  }

  function wirePanelClose() {
    qs("#panelCloseBtn")?.addEventListener("click", () => actions.selectReview(null, "ui"));
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

  // --- Data load ---
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

  // --- Render ---
  function render(s) {
    const list = getListForRender(s);

    // List
    const listUI = window.RR_UI_LIST || window.RR_LIST;
    if (listUI?.renderList) {
      listUI.renderList(list, s.ui.selectedReviewId, (id, source) =>
        actions.selectReview(id, source || "list")
      );
    }

    // Markers
    if (window.RR_MAP?.getMap?.() && window.google && google.maps) {
      const key = __rrMarkersKey(list);
      if (key !== __RR_MARKERS_KEY) {
        __RR_MARKERS_KEY = key;
        window.RR_MARKERS.renderMarkers(list, null, (id) => actions.selectReview(id, "map"));
      }
      window.RR_MARKERS.highlightSelected(s.ui.selectedReviewId);
    }

    // Panel content
    const review = getReviewByIdSafe(s, s.ui.selectedReviewId);
    window.RR_UI_PANEL?.renderPanel?.(review);

    // Panel visibility (single source of truth)
    const panelEl = qs("#reviewPanel");
    if (panelEl) {
      const open = !!review;
      panelEl.setAttribute("aria-hidden", open ? "false" : "true");
      panelEl.style.display = open ? "block" : "none";
    }

    // Slideshow images for fallback
    const gallery = qs("#panelGallery");
    if (gallery) {
      const imgs = Array.isArray(review?.images) ? review.images : [];
      gallery.dataset.images = JSON.stringify(imgs);
    }

    // Meta
    qs("#resultsMeta").textContent = `${list.length} recensioner`;

    // Mobile
    applyMobileMode(s.ui.viewMode || "list");
  }

  // --- Init ---
  async function init() {
    ensureAppMarkup();

    wireTopbar();
    wirePanelClose();
    wireMobileToggle();
    wireCommentForm();
    wireSlideshowFallback();

    // External modules can still wire themselves if present
    window.RR_UI_COMMENTS?.wireComments?.();
    window.RR_UI_MODAL?.wireModal?.();

    subscribe(render);

    const mapEl = qs("#map");
    try {
      if (window.RR_CONFIG_READY) await window.RR_CONFIG_READY;
      await window.RR_MAP.initMap(mapEl);
    } catch (e) {
      const hint = qs("#mapHint");
      hint.textContent = e.message || "Kunde inte initiera karta";
      setHidden(hint, false);
    }

    await loadReviewsOnce();

    // initial selection from URL
    const initialId = window.RR_ROUTER?.getSelectedId?.();
    const initialReview = getReviewByIdSafe(state, initialId);
    if (initialReview) {
      actions.selectReview(initialReview.id, "router");
      await window.RR_UI_COMMENTS?.loadComments?.(initialReview.id);
    }

    render(state);
  }

  document.addEventListener("DOMContentLoaded", init);
})();