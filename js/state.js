// state.js
(function () {
  const state = {
    data: {
      reviews: [],
      byId: {}, // <-- FIX: app.js använder byId
      commentsByReviewId: {}
    },
    ui: {
      selectedReviewId: null,

      // FIX: app.js använder viewMode
      viewMode: "list",

      // behåll även mobileMode för bakåtkompabilitet
      mobileMode: "list",

      filters: {
        sort: "latest",
        type: "",
        price: "",
        minRating: ""
      }
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

  function buildById(reviews) {
    const map = {};
    for (const r of reviews || []) {
      const id = Number(r.id);
      if (Number.isFinite(id)) map[id] = r;
    }
    return map;
  }

  // Prevent re-entrancy / selection loops
  let _selectLock = false;

  const actions = {
    setReviews(reviews) {
      state.data.reviews = Array.isArray(reviews) ? reviews : [];
      state.data.byId = buildById(state.data.reviews);
      emit("reviews:set");
    },

    // --- Filters (app.js expects setSort + setFilter) ---
    setSort(sort) {
      state.ui.filters.sort = sort || "latest";
      emit("ui:filters", { key: "sort", value: state.ui.filters.sort });
    },

    setFilter(key, value) {
      if (!key) return;
      state.ui.filters[key] = value ?? "";
      emit("ui:filters", { key, value: state.ui.filters[key] });
    },

    // keep your earlier API too
    setFilters(next) {
      state.ui.filters = { ...state.ui.filters, ...(next || {}) };
      emit("ui:filters");
    },

    // --- View mode (app.js expects setViewMode + ui.viewMode) ---
    setViewMode(mode) {
      const m = mode === "map" ? "map" : "list";
      state.ui.viewMode = m;
      state.ui.mobileMode = m; // keep in sync
      emit("ui:viewMode", { mode: m });
    },

    // keep earlier API too
    setMobileMode(mode) {
      actions.setViewMode(mode);
    },

    // --- Selection ---
    selectReview(id, source = "unknown") {
      if (_selectLock) return;
      _selectLock = true;
      try {
        const numId = (id === null || id === undefined || id === "") ? null : Number(id);
        const normalized = Number.isFinite(numId) ? numId : null;

        if (state.ui.selectedReviewId === normalized) return;
        state.ui.selectedReviewId = normalized;

        // Router update
        if (window.RR_ROUTER && typeof window.RR_ROUTER.setSelectedId === "function") {
          window.RR_ROUTER.setSelectedId(normalized);
        }

        emit("ui:selectedReviewId", { id: normalized, source });
      } finally {
        _selectLock = false;
      }
    }
  };

  // Optional selectors (app.js checks existence)
  const selectors = {
    getFilteredSortedReviews() {
      // Minimal implementation: just return reviews for now.
      // (Du kan bygga vidare på filters/sort här senare.)
      return state.data.reviews || [];
    }
  };

  window.RR_STATE = { state, actions, subscribe, selectors };
})();