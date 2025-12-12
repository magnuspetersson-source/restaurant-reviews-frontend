(function () {
  const { qs } = window.RR_DOM;

  function open() {
    const modal = qs("#slideshowModal");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function close() {
    const modal = qs("#slideshowModal");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function renderSlideshow(slideshow) {
    const modal = qs("#slideshowModal");
    const img = qs("#modalImage");
    const cap = qs("#modalCaption");
    const counter = qs("#modalCounter");

    if (!slideshow.open) {
      close();
      return;
    }

    const images = slideshow.images || [];
    const idx = Math.max(0, Math.min(images.length - 1, slideshow.index || 0));
    const current = images[idx];

    img.src = current ? current.url : "";
    img.alt = current ? (current.caption || "") : "";
    cap.textContent = (current && current.caption) ? current.caption : "";
    counter.textContent = images.length ? `${idx + 1} / ${images.length}` : "";

    open();
  }

  function prev() {
    const { state, actions } = window.RR_STATE;
    const s = state.ui.slideshow;
    const n = s.images.length;
    if (!n) return;
    actions.setSlideshowIndex((s.index - 1 + n) % n);
  }

  function next() {
    const { state, actions } = window.RR_STATE;
    const s = state.ui.slideshow;
    const n = s.images.length;
    if (!n) return;
    actions.setSlideshowIndex((s.index + 1) % n);
  }

  function wireModal() {
    qs("#modalOverlay").addEventListener("click", () => window.RR_STATE.actions.closeSlideshow());
    qs("#modalCloseBtn").addEventListener("click", () => window.RR_STATE.actions.closeSlideshow());
    qs("#modalPrevBtn").addEventListener("click", prev);
    qs("#modalNextBtn").addEventListener("click", next);

    window.addEventListener("keydown", (e) => {
      const { state } = window.RR_STATE;
      if (!state.ui.slideshow.open) return;
      if (e.key === "Escape") window.RR_STATE.actions.closeSlideshow();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    });
  }

  window.RR_UI_MODAL = { renderSlideshow, wireModal };
})();
