(function () {
  const CFG = window.RR_PUBLIC_CONFIG;

  function apiUrl(path) {
    // path like "/api/reviews"
    if (!CFG.apiBase) return path;
    return CFG.apiBase + path;
  }

  async function fetchJson(path, opts) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(apiUrl(path), {
        ...opts,
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          ...(opts && opts.headers ? opts.headers : {})
        }
      });

      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

      if (!res.ok) {
        const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function normalizeReview(r) {
    const images =
      (Array.isArray(r.images) && r.images.length)
        ? r.images.map(img => ({
            url: String(img.url || "").trim(),
            caption: String(img.caption || "").trim()
          })).filter(x => x.url)
        : (Array.isArray(r.image_urls) ? r.image_urls : []).map(u => ({ url: String(u).trim(), caption: "" })).filter(x => x.url);

    return {
      id: r.id,
      place_id: r.place_id,
      place_name: r.place_name,
      rating: r.rating,
      restaurant_type: r.restaurant_type ?? null,
      cost_level: r.cost_level ?? null,
      value_rating: r.value_rating ?? null,
      home_distance_km: r.home_distance_km ?? null,
      restaurant_lat: r.restaurant_lat ?? null,
      restaurant_lng: r.restaurant_lng ?? null,
      created_at: r.created_at ?? null,
      comment_html: r.comment || "",
      images
    };
  }

  async function getReviews() {
    const rows = await fetchJson("/api/reviews");
    const list = Array.isArray(rows) ? rows : [];
    return list.map(normalizeReview);
  }

  async function getComments(reviewId) {
    const q = encodeURIComponent(String(reviewId));
    const rows = await fetchJson(`/api/comments?reviewId=${q}`);
    return Array.isArray(rows) ? rows : [];
  }

  async function postComment(payload) {
    return fetchJson("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  window.RR_API = { getReviews, getComments, postComment };
})();
