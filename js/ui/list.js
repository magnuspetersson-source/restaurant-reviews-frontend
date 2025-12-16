(function () {
  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateYYYYMMDD(created_at) {
    if (!created_at) return "";
    // created_at is usually ISO string; keep it skimmable like admin list
    return String(created_at).slice(0, 10);
  }

  function formatStars(rating) {
    const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    const full = "★".repeat(n);
    const empty = "☆".repeat(5 - n);
    return full + empty;
  }

  function formatCost(cost) {
    if (cost == null) return "";
    const c = String(cost).trim();
    // If backend already sends "$$" keep it. If it sends 1-4 convert.
    if (c.includes("$")) return c;
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return "$".repeat(Math.max(1, Math.min(4, Math.round(n))));
    return c;
  }

  function formatType(t) {
    const s = String(t ?? "").trim();
    return s;
  }

  function formatDistanceKm(km) {
    const n = Number(km);
    if (!Number.isFinite(n)) return "";
    // 0.0–9.9 => one decimal, 10+ => integer
    const txt = n < 10 ? n.toFixed(1) : String(Math.round(n));
    return `${txt} km`;
  }

  function renderList(reviews, selectedId, onPick) {
    const listEl = document.getElementById("reviewList");
    if (!listEl) return;

    listEl.innerHTML = "";

    (reviews || []).forEach((r) => {
      const id = Number(r.id);
      const isSelected = id === Number(selectedId);

      const name = r.place_name || "";
      const stars = formatStars(r.rating);
      const date = formatDateYYYYMMDD(r.created_at);

      const type = formatType(r.restaurant_type);
      const cost = formatCost(r.cost_level);

      // Prefer computed distance from app.js if present, fallback to home_distance_km
      const km = r._distance_km != null ? r._distance_km : r.home_distance_km;
      const dist = formatDistanceKm(km);

      const metaParts = [type, cost, dist].filter(Boolean);

      const card = document.createElement("div");
      card.className = "card" + (isSelected ? " is-selected" : "");
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-pressed", isSelected ? "true" : "false");

      card.innerHTML = `
        <div class="card__title">${esc(name)}</div>

        <div class="card__row1">
          <span class="card__stars" aria-label="Betyg">${esc(stars)}</span>
          ${date ? `<span class="card__date">${esc(date)}</span>` : ""}
        </div>

        ${metaParts.length ? `<div class="card__row2">${esc(metaParts.join(" · "))}</div>` : ""}
      `;

      const pick = () => onPick?.(r.id, "list");

      card.addEventListener("click", pick);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pick();
        }
      });

      listEl.appendChild(card);
    });
  }

  window.RR_LIST = { renderList };
})();