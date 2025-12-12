(function () {
  const listeners = new Set();

  const state = {
    data: {
      reviews: [],
      byId: {},
      commentsByReviewId: {}
    },
    ui: {
      selectedReviewId: null,
      filters: { type: "", price: "", minRating: "" },
      sort: "latest",
      viewMode: "list",
      slideshow: { open: false, index: 0, images: [] }
    },
    net: {
      loading: { reviews: false, comments: false, postComment: false },
      error: { reviews: null, comments: null, postComment: null }
    }
  };

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function emit() { listeners.forEach(fn => fn(state)); }

  function setNetLoading(key, v) { state.net.loading[key] = !!v; emit(); }
  function setNetError(key, msg) { state.net.error[key] = msg || null; emit(); }

  function setReviews(reviews) {
    state.data.reviews = Array.isArray(reviews) ? reviews : [];
    const byId = {};
    for (const r of state.data.reviews) byId[r.id] = r;
    state.data.byId = byId;
    emit();
  }

  function selectReview(id) {
    state.ui.selectedReviewId = id;
    window.RR_ROUTER.setSelectedId(id);
    emit();
  }

  function setComments(reviewId, comments) {
    state.data.commentsByReviewId[String(reviewId)] = Array.isArray(comments) ? comments : [];
    emit();
  }

  function openSlideshow(images, index) {
    state.ui.slideshow = { open: true, images: images || [], index: index || 0 };
    emit();
  }
  function closeSlideshow() {
    state.ui.slideshow = { open: false, images: [], index: 0 };
    emit();
  }
  function setSlideshowIndex(i) {
    const s = state.ui.slideshow;
    state.ui.slideshow = { ...s, index: i };
    emit();
  }

  function setFilter(key, value) {
    state.ui.filters = { ...state.ui.filters, [key]: value };
    emit();
  }
  function setSort(value) { state.ui.sort = value; emit(); }
  function setViewMode(value) { state.ui.viewMode = value; emit(); }

  function getFilteredSortedReviews() {
    let list = state.data.reviews.slice();
    const { type, price, minRating } = state.ui.filters;

    if (type) list = list.filter(r => String(r.restaurant_type || "").toLowerCase() === String(type).toLowerCase());
    if (price) list = list.filter(r => Number(r.cost_level) === Number(price));
    if (minRating) list = list.filter(r => Number(r.rating || 0) >= Number(minRating));

    switch (state.ui.sort) {
      case "rating_desc":
        list.sort((a,b) => Number(b.rating||0) - Number(a.rating||0));
        break;
      case "value_desc":
        list.sort((a,b) => Number(b.value_rating||0) - Number(a.value_rating||0));
        break;
      case "distance_asc":
        list.sort((a,b) => Number(a.home_distance_km??1e9) - Number(b.home_distance_km??1e9));
        break;
      case "latest":
      default:
        list.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
        break;
    }

    return list;
  }

  window.RR_STATE = {
    state,
    subscribe,
    actions: {
      setNetLoading, setNetError,
      setReviews, selectReview, setComments,
      openSlideshow, closeSlideshow, setSlideshowIndex,
      setFilter, setSort, setViewMode
    },
    selectors: { getFilteredSortedReviews }
  };
})();
