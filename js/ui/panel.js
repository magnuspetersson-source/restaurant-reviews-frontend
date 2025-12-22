// panel.js — renderer that supports top-right meta row + main meta row
(function () {
  function qs(sel) { return document.querySelector(sel); }
  function escapeText(s) { return String(s ?? ""); }

  function ensureMetaTop() {
    const header = qs("#reviewPanel .panel__header");
    if (!header) return null;

    let top = qs("#panelMetaTop");
    if (!top) {
      top = document.createElement("div");
      top.id = "panelMetaTop";
      top.className = "panel__metaTop";
      header.appendChild(top);
    }
    return top;
  }

  function fmtStars(rating) {
    const n = Number(rating);
    if (!Number.isFinite(n)) return "";
    // show 1 decimal if needed
    const txt = Number.isInteger(n) ? String(n) : n.toFixed(1);
    return `★ ${txt}`;
  }

  function fmtDate(d) {
    if (!d) return "";
    // assume backend returns ISO date or similar; keep it simple and readable
    return escapeText(String(d)).slice(0, 10);
  }

  function fmtPrice(level) {
    const n = Number(level) || 0;
    return n > 0 ? "$".repeat(Math.min(5, Math.max(1, n))) : "";
  }

  function fmtKm(km) {
    const n = Number(km);
    return Number.isFinite(n) ? `${n.toFixed(1)} km` : "";
  }

  function renderPanel(review) {
    const titleEl = qs("#panelTitle");
    const metaEl = qs("#panelMeta");
    const contentEl = qs("#panelContent");
    const galleryEl = qs("#panelGallery");
    const metaTopEl = ensureMetaTop();

    if (!titleEl || !metaEl || !contentEl) return;

    if (!review) {
      titleEl.textContent = "";
      metaEl.textContent = "";
      if (metaTopEl) metaTopEl.textContent = "";
      contentEl.innerHTML = "";
      if (galleryEl) galleryEl.innerHTML = "";
      return;
    }

    // --- Top-right meta: Title + (stars/date) + (type/price/distance + label)
    if (metaTopEl) {
      // Date fallback: review_date -> visited_at -> created_at -> updated_at
      const dateRaw = review.review_date || review.visited_at || review.created_at || review.updated_at || "";
      const date = fmtDate(dateRaw);
    
      // Stars as glyphs (like list)
      const stars = (() => {
        const n = Number(review.rating);
        if (!Number.isFinite(n)) return "";
        const filled = Math.max(0, Math.min(5, Math.round(n)));
        return "★".repeat(filled) + "☆".repeat(5 - filled);
      })();
    
      const row1 = [];
      if (stars) row1.push(stars);
      if (date) row1.push(date);
    
      // Row2: type · price · distance (+ label)
      const row2 = [];
      if (review.restaurant_type) row2.push(escapeText(review.restaurant_type));
    
      const price = fmtPrice(review.cost_level);
      if (price) row2.push(price);
    
      const dist = fmtKm(review._distance_km);
      if (dist) row2.push(dist);
    
      // distance label from app.js (we’ll set this global)
      const label = window.RR_DISTANCE_LABEL || "";
      const row2Text = row2.filter(Boolean).join(" · ");
      const row2Full = label ? `${row2Text} · ${label}` : row2Text;
    
      metaTopEl.innerHTML = `
        <div class="pm-title">${escapeText(review.place_name || "")}</div>
        <div class="pm-row1">${row1.join(" ")}</div>
        <div class="pm-row2">${row2Full}</div>
      `;
    }
    
    // We keep the left title, but we move all “meta” to top-right now
    metaEl.textContent = "";
    
    // --- Content (review text)
    // Your data currently has review html in comment_html (and sometimes comment)
    const html = review.comment_html || review.comment || "";
    contentEl.innerHTML = html ? String(html) : "<p><em>Ingen recensionstext.</em></p>";
    
    // --- "Läs mer…" collapse/expand (5 lines)
    let btn = document.getElementById("panelReadMoreBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "panelReadMoreBtn";
      btn.type = "button";
      btn.className = "readMoreBtn";
      btn.textContent = "Läs mer…";
      contentEl.insertAdjacentElement("afterend", btn);
    
      btn.addEventListener("click", () => {
        const collapsed = contentEl.classList.toggle("is-collapsed");
        btn.textContent = collapsed ? "Läs mer…" : "Visa mindre";
      });
    }
    
    // reset collapsed on each review render
    contentEl.classList.add("is-collapsed");
    btn.textContent = "Läs mer…";
    btn.hidden = true;
    
    // show button only if content actually overflows when collapsed
    requestAnimationFrame(() => {
      // If scrollHeight > clientHeight, it means we truncated
      btn.hidden = !(contentEl.scrollHeight > contentEl.clientHeight + 2);
    });

    // --- Gallery thumbs
    if (galleryEl) {
      galleryEl.innerHTML = "";
      const imgs = Array.isArray(review.images) ? review.images : [];
      imgs.forEach((img, i) => {
        const d = document.createElement("div");
        d.className = "gallery__item";
        d.setAttribute("data-index", String(i));   // ✅ key fix
      
        const im = document.createElement("img");
        im.src = img.url;
        im.alt = img.caption || "";
        im.setAttribute("data-index", String(i)); // (belt & suspenders)
        d.appendChild(im);
      
        galleryEl.appendChild(d);
      });
    }
  }

  window.RR_UI_PANEL = { renderPanel };
})();