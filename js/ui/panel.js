// panel.js — SAFE renderer (no dependencies, never controls open/close)
(function () {
  function qs(sel) {
    return document.querySelector(sel);
  }

  function escapeText(s) {
    return String(s ?? "");
  }

  function renderPanel(review) {
    const titleEl = qs("#panelTitle");
    const metaEl = qs("#panelMeta");
    const contentEl = qs("#panelContent");
    const galleryEl = qs("#panelGallery");

    if (!titleEl || !metaEl || !contentEl) return;

    if (!review) {
      titleEl.textContent = "";
      metaEl.textContent = "";
      contentEl.innerHTML = "";
      if (galleryEl) galleryEl.innerHTML = "";
      return;
    }

    // Title
    titleEl.textContent = review.place_name || "";

    // Meta (keep it simple + safe)
    const parts = [];
    if (review.rating != null) parts.push(`★ ${review.rating}`);
    if (review.review_date) parts.push(escapeText(review.review_date));
    if (review.restaurant_type) parts.push(escapeText(review.restaurant_type));
    if (review.cost_level) parts.push("$".repeat(Number(review.cost_level) || 0));
    if (review._distance_km != null) parts.push(`${Number(review._distance_km).toFixed(1)} km`);

    metaEl.textContent = parts.filter(Boolean).join(" · ");

    // Content (Quill HTML usually lives in review.comment)
    const html = review.comment_html || review.comment || "";
    contentEl.innerHTML = html ? String(html) : "<p><em>Ingen recensionstext.</em></p>";

    // Gallery (optional)
    if (galleryEl) {
      galleryEl.innerHTML = "";
      const imgs = Array.isArray(review.images) ? review.images : [];
      imgs.forEach((img) => {
        const d = document.createElement("div");
        d.className = "gallery__item";
        const im = document.createElement("img");
        im.src = img.url;
        im.alt = img.caption || "";
        d.appendChild(im);
        galleryEl.appendChild(d);
      });
    }
  }

  window.RR_UI_PANEL = { renderPanel };
})();