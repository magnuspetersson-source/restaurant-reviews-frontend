// app.js
(async function () {
  function init() {
    const { state, actions, subscribe } = window.RR_STATE;

    // 1) Subscribe render pipeline
    let lastMarkersKey = "";

    subscribe((s, reason, payload) => {
      // Always render list/panel
      renderUI(s, actions);

      // Markers: only rebuild when list changes
      const reviews = s.data.reviews || [];
      const key = reviews.map(r => `${r.id}:${r.restaurant_lat}:${r.restaurant_lng}`).join("|");

      if (key !== lastMarkersKey) {
        lastMarkersKey = key;
        window.RR_MARKERS?.renderMarkers(reviews, (id) => actions.selectReview(id, "map"));
      }

      // Selection: always highlight (cheap)
      window.RR_MARKERS?.highlightSelected(s.ui.selectedReviewId, { pan: true });
    });

    // 2) Kick off loading
    loadReviewsOnce(actions).catch(console.error);
  }

  async function loadReviewsOnce(actions) {
    const reviews = await window.RR_API.getReviews();
    actions.setReviews(reviews);

    // Optional: auto-select first
    if (reviews && reviews[0]) actions.selectReview(reviews[0].id, "init");
  }

  function renderUI(s, actions) {
    // Render list
    window.RR_LIST?.renderList(s.data.reviews, s.ui.selectedReviewId, (id, source) =>
      actions.selectReview(id, source || "list")
    );

    // Render panel (om du har RR_PANEL)
    window.RR_PANEL?.renderPanel?.(s.data.reviews, s.ui.selectedReviewId, actions);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();