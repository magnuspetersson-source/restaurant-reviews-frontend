(function () {
  const { qs, setHidden } = window.RR_DOM;
  const { actions, selectors, state, subscribe } = window.RR_STATE;

  async function init() {
    // Wire UI controls
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
