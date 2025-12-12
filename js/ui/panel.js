(function () {
  const { qs, el } = window.RR_DOM;
  const { dollars, stars, km } = window.RR_FMT;
  const { sanitizeHtml } = window.RR_SANITIZE;

  function openPanel() {
    const panel = qs("#reviewPanel");
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
  }

  function closePanel() {
    const panel = qs("#reviewPanel");
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
  }

  function renderPanel(review) {
    const title = qs("#panelTitle");
    const meta = qs("#panelMeta");
    const content = qs("#panelContent");
    const gallery = qs("#panelGallery");

    if (!review) {
      title.textContent = "";
      meta.innerHTML = "";
      content.innerHTML = "";
      gallery.innerHTML = "";
      closePanel();
      return;
    }

    title.textContent = review.place_name || "";
    meta.innerHTML = "";

    const chips = [];
    if (review.rating) chips.push(el("span", { class: "badge", text: stars(review.rating) }));
    if (review.cost_level) chips.push(el("span", { class: "badge", text: dollars(review.cost_level) }));
    if (review.value_rating) chips.push(el("span", { class: "badge", text: `Value ${review.value_rating}/5` }));
    if (review.home_distance_km !== null && review.home_distance_km !== undefined) chips.push(el("span", { class: "badge", text: km(review.home_distance_km) }));
    if (review.restaurant_type) chips.push(el("span", { class: "badge", text: review.restaurant_type }));
    chips.forEach(c => meta.appendChild(c));

    gallery.innerHTML = "";
    (review.images || []).forEach((img, idx) => {
      const item = el("div", { class: "gallery__item", role: "button", tabindex: "0" }, [
        el("img", { src: img.url, alt: img.caption || "" })
      ]);
      item.addEventListener("click", () => window.RR_STATE.actions.openSlideshow(review.images, idx));
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") window.RR_STATE.actions.openSlideshow(review.images, idx);
      });
      gallery.appendChild(item);
    });

    const safeHtml = sanitizeHtml(review.comment_html || "");
    content.innerHTML = safeHtml || "<p><em>Ingen recensionstext.</em></p>";

    openPanel();
  }

  window.RR_UI_PANEL = { renderPanel, openPanel, closePanel };
})();
