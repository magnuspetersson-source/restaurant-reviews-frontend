function ensureAppMarkup() {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app root");

  // Om topbaren redan finns, gör inget
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
  const { actions, selectors, state, subscribe } = window.RR_STATE;

  async function init() {
    // Wire UI controls
    ensureAppMarkup();
    wireTopbar();
    wirePanel();
    window.RR_UI_COMMENTS.wireComments();
    window.RR_UI_MODAL.wireModal();
    wireMobileToggle();

    // Map init
    const mapEl = qs("#map");
    try {
      await window.RR_MAP.initMap(mapEl);
    } catch (e) {
      const hint = qs("#mapHint");
      hint.textContent = e.message || "Kunde inte initiera karta";
      setHidden(hint, false);
    }

    // Load data
    await loadReviewsOnce();

    // initial selection from URL
    const initialId = window.RR_ROUTER.getSelectedId();
    if (initialId && state.data.byId[initialId]) {
      actions.selectReview(initialId);
      await window.RR_UI_COMMENTS.loadComments(initialId);
    }

    // Subscribe render
    subscribe(render);
    render(state);
  }

  async function loadReviewsOnce() {
    actions.setNetLoading("reviews", true);
    actions.setNetError("reviews", null);

    const statusArea = qs("#statusArea");
    statusArea.textContent = "Laddar recensioner…";
    setHidden(statusArea, false);

    try {
      const reviews = await window.RR_API.getReviews();
      actions.setReviews(reviews);

      // fill type dropdown once
      window.RR_UI_LIST.renderTypeOptions(reviews);

      setHidden(statusArea, true);
    } catch (e) {
      actions.setNetError("reviews", e.message || "Kunde inte hämta recensioner");
      statusArea.textContent = `Fel: ${e.message || "Kunde inte hämta recensioner"}`;
      setHidden(statusArea, false);
    } finally {
      actions.setNetLoading("reviews", false);
    }
  }

  function wireTopbar() {
    qs("#sortSelect").addEventListener("change", (e) => actions.setSort(e.target.value));
    qs("#typeSelect").addEventListener("change", (e) => actions.setFilter("type", e.target.value));
    qs("#priceSelect").addEventListener("change", (e) => actions.setFilter("price", e.target.value));
    qs("#minRatingSelect").addEventListener("change", (e) => actions.setFilter("minRating", e.target.value));
  }

  function wirePanel() {
    qs("#panelCloseBtn").addEventListener("click", () => actions.selectReview(null));
  }

  function wireMobileToggle() {
    const toggle = qs("#mobileToggle");
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
    const btns = Array.from(qs("#mobileToggle").querySelectorAll("button"));

    if (!isMobile) {
      colMap.style.display = "";
      colList.style.display = "";
      btns.forEach(b => b.classList.remove("is-active"));
      return;
    }

    btns.forEach(b => b.classList.toggle("is-active", b.getAttribute("data-mode") === viewMode));
    if (viewMode === "map") {
      colMap.style.display = "block";
      colList.style.display = "none";
    } else {
      colMap.style.display = "none";
      colList.style.display = "block";
    }
  }

  function render(s) {
    // List + markers based on filtered/sorted
    const list = selectors.getFilteredSortedReviews();
    window.RR_UI_LIST.renderList(list, s.ui.selectedReviewId);

    // Map markers
    if (window.RR_MAP.getMap() && window.google && google.maps) {
      window.RR_MARKERS.renderMarkers(list, s.ui.selectedReviewId, (id) => actions.selectReview(id));
      window.RR_MARKERS.highlightSelected(s.ui.selectedReviewId);
    }

    // Panel
    const review = s.ui.selectedReviewId ? s.data.byId[s.ui.selectedReviewId] : null;
    window.RR_UI_PANEL.renderPanel(review);

    // Comments (for selected)
    if (s.ui.selectedReviewId) {
      const comments = s.data.commentsByReviewId[String(s.ui.selectedReviewId)] || [];
      window.RR_UI_COMMENTS.renderComments(comments);
    } else {
      window.RR_UI_COMMENTS.renderComments([]);
    }

    // Slideshow modal
    window.RR_UI_MODAL.renderSlideshow(s.ui.slideshow);

    // Meta
    const meta = qs("#resultsMeta");
    meta.textContent = `${list.length} recensioner`;

    // Mobile mode
    applyMobileMode(s.ui.viewMode);
  }

  // When selection changes: load comments (if not already loaded)
  subscribe(async (s) => {
    const id = s.ui.selectedReviewId;
    if (!id) return;
    if (s.data.commentsByReviewId[String(id)]) return;
    await window.RR_UI_COMMENTS.loadComments(id);
  });

  // Close panel on escape (when not in slideshow)
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const { state } = window.RR_STATE;
    if (state.ui.slideshow.open) return;
    if (state.ui.selectedReviewId) window.RR_STATE.actions.selectReview(null);
  });

  document.addEventListener("DOMContentLoaded", init);
})();
