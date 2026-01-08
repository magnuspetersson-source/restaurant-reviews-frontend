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
  
  function enableSwipeOnModal({ onPrev, onNext }) {
    const media = document.querySelector("#slideshowModal .modal__media");
    if (!media) return;
  
    let startX = 0;
    let startY = 0;
    let tracking = false;
  
    const THRESHOLD = 40; // px horizontal swipe
    const RESTRAINT = 60; // px vertical tolerance
  
    // Allow vertical scroll but capture horizontal swipes
    media.style.touchAction = "pan-y";
  
    media.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    }, { passive: true });
  
    media.addEventListener("touchmove", (e) => {
      if (!tracking || !e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
  
      // If horizontal swipe, prevent page scroll
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        e.preventDefault();
      }
    }, { passive: false });
  
    media.addEventListener("touchend", (e) => {
      if (!tracking) return;
      tracking = false;
  
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
  
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
  
      if (Math.abs(dy) > RESTRAINT) return;
      if (Math.abs(dx) < THRESHOLD) return;
  
      if (dx < 0) onNext?.();
      else onPrev?.();
    }, { passive: true });
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
    enableSwipeOnModal({ onPrev: prev, onNext: next });
  }

  window.RR_UI_MODAL = { renderSlideshow, wireModal };
})();
