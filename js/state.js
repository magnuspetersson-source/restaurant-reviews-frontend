// state.js
(function () {
  const state = {
    data: {
      reviews: [],
      commentsByReviewId: {}
    },
    ui: {
      selectedReviewId: null,
      filters: {
        sort: "latest",
        type: "",
        price: "",
        minRating: ""
      },
      mobileMode: "list"
    }
  };

  const listeners = new Set();

  function emit(reason, payload) {
    for (const fn of listeners) fn(state, reason, payload);
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  // Prevent re-entrancy / selection loops
  let _selectLock = false;

  const actions = {
    setReviews(reviews) {
      state.data.reviews = Array.isArray(reviews) ? reviews : [];
      emit("reviews:set");
    },

    setMobileMode(mode) {
      state.ui.mobileMode = mode === "map" ? "map" : "list";
      emit("ui:mobileMode");
    },

    setFilters(next) {
      state.ui.filters = { ...state.ui.filters, ...(next || {}) };
      emit("ui:filters");
    },

    selectReview(id, source = "unknown") {
      if (_selectLock) return;
      _selectLock = true;
      try {
        const numId = id == null ? null : Number(id);
        if (state.ui.selectedReviewId === numId) return;

        state.ui.selectedReviewId = numId;

        // Router update (but do not trigger selection loop)
        if (window.RR_ROUTER && typeof window.RR_ROUTER.setSelectedId === "function") {
          window.RR_ROUTER.setSelectedId(numId);
        }

        emit("ui:selectedReviewId", { id: numId, source });
      } finally {
        _selectLock = false;
      }
    }
  };

  window.RR_STATE = { state, actions, subscribe };
})();