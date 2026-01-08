(function () {
  const { qs } = window.RR_DOM;

  // =========================================================
  // Autoplay (robust: clicks Next button)
  // =========================================================
  const AUTO_MS = 4000;
  const OPEN_POLL_MS = 250;

  let __autoTimer = null;
  let __openPoll = null;

  function modalEl() { return qs("#slideshowModal"); }

  function isModalOpen() {
    const modal = modalEl();
    if (!modal) return false;

    // Fast path: your intended flags
    const byClass = modal.classList.contains("is-open");
    const byAria = modal.getAttribute("aria-hidden") === "false";

    if (byClass || byAria) return true;

    // Fallback: computed visibility (handles "display:block" opens, style toggles, etc)
    const cs = window.getComputedStyle(modal);
    if (!cs) return false;

    if (cs.display === "none") return false;
    if (cs.visibility === "hidden") return false;
    if (cs.opacity === "0") return false;

    // If it takes space and is interactable, treat as open
    // (pointer-events may be none for overlay systems, so don't require it)
    return true;
  }

  function getImageCountHint() {
    // Try state first (if used)
    try {
      const s = window.RR_STATE?.state?.ui?.slideshow;
      if (s && Array.isArray(s.images)) return s.images.length;
    } catch {}

    // Fallback: parse "1 / N" counter if present
    const ctr = qs("#modalCounter")?.textContent || "";
    const m = ctr.match(/\/\s*(\d+)/);
    if (m) return Number(m[1]) || 0;

    // Unknown yet
    return 0;
  }

  function stopAuto() {
    if (__autoTimer) {
      clearInterval(__autoTimer);
      __autoTimer = null;
    }
  }

  function startAutoIfNeeded() {
    // Don't start twice
    if (__autoTimer) return;

    const n = getImageCountHint();
    // If we KNOW there is exactly 1 image, don't autoplay.
    // If n === 0, it may just not be rendered yet — still start.
    if (n === 1) return;

    __autoTimer = setInterval(() => {
      if (!isModalOpen()) {
        stopAuto();
        return;
      }
      const nextBtn = qs("#modalNextBtn");
      if (nextBtn) nextBtn.click();
    }, AUTO_MS);
  }

  function resetAuto() {
    stopAuto();
    if (isModalOpen()) startAutoIfNeeded();
  }

  function ensureOpenPolling() {
    if (__openPoll) return;

    __openPoll = setInterval(() => {
      const open = isModalOpen();
      if (open) startAutoIfNeeded();
      else stopAuto();
    }, OPEN_POLL_MS);
  }

  // =========================================================
  // Modal open/close + render (if RR_STATE drives it)
  // =========================================================
  function open() {
    const modal = modalEl();
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function close() {
    const modal = modalEl();
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function renderSlideshow(slideshow) {
    const img = qs("#modalImage");
    const cap = qs("#modalCaption");
    const counter = qs("#modalCounter");

    if (!slideshow || !slideshow.open) {
      stopAuto();
      close();
      return;
    }

    const images = slideshow.images || [];
    const idx = Math.max(0, Math.min(images.length - 1, slideshow.index || 0));
    const current = images[idx];

    if (img) {
      img.src = current ? current.url : "";
      img.alt = current ? (current.caption || "") : "";
    }
    if (cap) cap.textContent = (current && current.caption) ? current.caption : "";
    if (counter) counter.textContent = images.length ? `${idx + 1} / ${images.length}` : "";

    open();

    // Kick autoplay after DOM updates settle a tiny bit
    setTimeout(() => {
      if (isModalOpen()) startAutoIfNeeded();
    }, 50);
  }

  // =========================================================
  // Navigation (state-based if available) + always reset autoplay
  // =========================================================
  function prev() {
    try {
      const { state, actions } = window.RR_STATE;
      const s = state.ui.slideshow;
      const n = (s.images || []).length;
      if (n) actions.setSlideshowIndex((s.index - 1 + n) % n);
    } catch {}
    resetAuto();
  }

  function next() {
    try {
      const { state, actions } = window.RR_STATE;
      const s = state.ui.slideshow;
      const n = (s.images || []).length;
      if (n) actions.setSlideshowIndex((s.index + 1) % n);
    } catch {}
    resetAuto();
  }

  // =========================================================
  // Swipe
  // =========================================================
  function enableSwipeOnModal({ onPrev, onNext }) {
    const media = document.querySelector("#slideshowModal .modal__media");
    if (!media) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const THRESHOLD = 40;
    const RESTRAINT = 60;

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

      resetAuto();
    }, { passive: true });
  }

  // =========================================================
  // Wiring
  // =========================================================
  function wireModal() {
    // Always enable open polling (handles any open mechanism)
    ensureOpenPolling();

    const closeNow = () => {
      stopAuto();
      window.RR_STATE?.actions?.closeSlideshow?.();
      // In case closeSlideshow isn't used by your fallback, still force close flags:
      close();
    };

    qs("#modalOverlay")?.addEventListener("click", closeNow);
    qs("#modalCloseBtn")?.addEventListener("click", closeNow);

    // NOTE: Do NOT preventDefault/stopPropagation here; you may have a fallback handler too.
    qs("#modalPrevBtn")?.addEventListener("click", () => { prev(); });
    qs("#modalNextBtn")?.addEventListener("click", () => { next(); });

    window.addEventListener("keydown", (e) => {
      if (!isModalOpen()) return;

      if (e.key === "Escape") closeNow();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    });

    enableSwipeOnModal({ onPrev: prev, onNext: next });

    // Start immediately if modal is already open at wire-time
    setTimeout(() => {
      if (isModalOpen()) startAutoIfNeeded();
    }, 50);
  }

  window.RR_UI_MODAL = { renderSlideshow, wireModal };
})();