(function () {
  let markerById = new Map();
  let reviewById = new Map();

  let lastRenderedKey = "";
  let lastSelectedId = null;

  let infoWindow = null;

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
    return String(created_at).slice(0, 10);
  }

  function formatStars(rating) {
    const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  function formatCost(cost) {
    if (cost == null) return "";
    const c = String(cost).trim();
    if (c.includes("$")) return c;
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return "$".repeat(Math.max(1, Math.min(4, Math.round(n))));
    return c;
  }

  function formatDistanceKm(km) {
    const n = Number(km);
    if (!Number.isFinite(n)) return "";
    const txt = n < 10 ? n.toFixed(1) : String(Math.round(n));
    return `${txt} km`;
  }

  function googleMapsUrlFor(r) {
    const pid = String(r.place_id || "").trim();
    if (pid) {
      // Place-id deep link
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        r.place_name || ""
      )}&query_place_id=${encodeURIComponent(pid)}`;
    }
    const lat = r.restaurant_lat != null ? Number(r.restaurant_lat) : null;
    const lng = r.restaurant_lng != null ? Number(r.restaurant_lng) : null;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
    }
    return "";
  }

  function buildInfoHtml(r) {
    const name = esc(r.place_name || "");
    const stars = esc(formatStars(r.rating));
    const date = esc(formatDateYYYYMMDD(r.created_at));
    const type = esc(String(r.restaurant_type || "").trim());
    const cost = esc(formatCost(r.cost_level));

    const km = r._distance_km != null ? r._distance_km : r.home_distance_km;
    const dist = esc(formatDistanceKm(km));

    const metaParts = [type, cost, dist].filter(Boolean).join(" · ");

    const url = googleMapsUrlFor(r);
    const linkHtml = url
      ? `<a href="${esc(url)}" target="_blank" rel="noopener">Öppna i Google</a>`
      : "";

    // Small, readable, Squarespace-ish: no hardcoded colors/fonts.
    return `
      <div class="rr-iw">
        <div class="rr-iw__title">${name}</div>
        <div class="rr-iw__meta">
          <span class="rr-iw__stars">${stars}</span>
          ${date ? `<span class="rr-iw__date">${date}</span>` : ""}
        </div>
        ${metaParts ? `<div class="rr-iw__sub">${esc(metaParts)}</div>` : ""}
        ${linkHtml ? `<div class="rr-iw__link">${linkHtml}</div>` : ""}
      </div>
    `;
  }

  function computeKey(reviews) {
    return (reviews || [])
      .map((r) => `${r.id}:${r.restaurant_lat}:${r.restaurant_lng}`)
      .join("|");
  }

  function clearMarkers() {
    for (const m of markerById.values()) m.setMap(null);
    markerById.clear();
    reviewById.clear();
    lastRenderedKey = "";
    lastSelectedId = null;
    if (infoWindow) infoWindow.close();
  }

  function ensureInfoWindow() {
    if (!infoWindow) infoWindow = new google.maps.InfoWindow();
    return infoWindow;
  }

  // Backwards compatible:
  // - renderMarkers(reviews, onPick)
  // - renderMarkers(reviews, _unused, onPick)
  function renderMarkers(reviews, arg2, arg3) {
    const map = window.RR_MAP?.getMap?.();
    if (!map || !Array.isArray(reviews)) return;

    const onPick = typeof arg2 === "function" ? arg2 : typeof arg3 === "function" ? arg3 : null;

    const key = computeKey(reviews);
    if (key === lastRenderedKey) {
      // Update reviewById (e.g. distance mode changed) without rebuilding markers
      reviewById.clear();
      for (const r of reviews) reviewById.set(Number(r.id), r);
      return;
    }

    lastRenderedKey = key;
    lastSelectedId = null;

    // Rebuild markers
    for (const m of markerById.values()) m.setMap(null);
    markerById.clear();
    reviewById.clear();

    for (const r of reviews) {
      const lat = r.restaurant_lat != null ? Number(r.restaurant_lat) : null;
      const lng = r.restaurant_lng != null ? Number(r.restaurant_lng) : null;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      reviewById.set(Number(r.id), r);

      const marker = new google.maps.Marker({
        map,
        position: { lat, lng },
        title: r.place_name || "",
        // IMPORTANT: no icon => Google default red pin
        zIndex: 1
      });

      marker.addListener("click", () => {
        onPick?.(r.id);

        // Show InfoWindow immediately on map click (even before highlightSelected runs)
        try {
          const iw = ensureInfoWindow();
          iw.setContent(buildInfoHtml(r));
          iw.open({ map, anchor: marker, shouldFocus: false });
        } catch (e) {
          console.warn("[RR_MARKERS] InfoWindow failed:", e);
        }
      });

      markerById.set(Number(r.id), marker);
    }
  }

  // Guard panTo to avoid re-entrancy storms
  let isHighlighting = false;

  function highlightSelected(selectedId, opts = { pan: true }) {
    const map = window.RR_MAP?.getMap?.();
    if (!map) return;

    const id = selectedId == null ? null : Number(selectedId);
    if (id === lastSelectedId) {
      // Still ensure info reflects e.g. distance mode changes
      if (id != null) showInfoFor(id);
      return;
    }

    if (isHighlighting) return;
    isHighlighting = true;
    try {
      // Unselect previous
      if (lastSelectedId != null) {
        const prev = markerById.get(Number(lastSelectedId));
        if (prev) {
          prev.setZIndex(1);
          prev.setAnimation(null);
        }
      }

      lastSelectedId = id;

      // Select new
      if (id != null) {
        const m = markerById.get(id);
        if (m) {
          m.setZIndex(999);

          // A subtle highlight without changing pin style:
          // brief bounce to indicate selection
          m.setAnimation(google.maps.Animation.BOUNCE);
          window.setTimeout(() => m.setAnimation(null), 700);

          if (opts?.pan) {
            const pos = m.getPosition();
            if (pos) map.panTo(pos);
          }

          showInfoFor(id);
        } else if (infoWindow) {
          infoWindow.close();
        }
      } else if (infoWindow) {
        infoWindow.close();
      }
    } finally {
      isHighlighting = false;
    }
  }

  function showInfoFor(id) {
    const map = window.RR_MAP?.getMap?.();
    if (!map) return;

    const r = reviewById.get(Number(id));
    const m = markerById.get(Number(id));
    if (!r || !m) return;

    try {
      const iw = ensureInfoWindow();
      iw.setContent(buildInfoHtml(r));
      iw.open({ map, anchor: m, shouldFocus: false });
    } catch (e) {
      console.warn("[RR_MARKERS] showInfoFor failed:", e);
    }
  }

  window.RR_MARKERS = { renderMarkers, highlightSelected, clearMarkers };
})();