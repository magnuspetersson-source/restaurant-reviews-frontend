// markers.js
(function () {
  let markerById = new Map();
  let lastRenderedKey = "";
  let lastSelectedId = null;

  function makeIcon(isSelected) {
    // Google default red-ish pin look, but with size difference
    // (adjust if you have a custom icon function elsewhere)
    const scale = isSelected ? 8 : 6;
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale,
      fillOpacity: 1,
      strokeOpacity: 1,
      strokeWeight: 2
    };
  }

  function computeKey(reviews) {
    // Stable key so we only rebuild markers when the list changes
    return (reviews || [])
      .map((r) => `${r.id}:${r.restaurant_lat}:${r.restaurant_lng}`)
      .join("|");
  }

  function clearMarkers() {
    for (const m of markerById.values()) m.setMap(null);
    markerById.clear();
  }

  function renderMarkers(reviews, onPick) {
    const map = window.RR_MAP?.getMap?.();
    if (!map || !Array.isArray(reviews)) return;

    const key = computeKey(reviews);
    if (key === lastRenderedKey) return; // list unchanged

    lastRenderedKey = key;
    lastSelectedId = null;

    clearMarkers();

    for (const r of reviews) {
      if (r.restaurant_lat == null || r.restaurant_lng == null) continue;

      const marker = new google.maps.Marker({
        map,
        position: { lat: Number(r.restaurant_lat), lng: Number(r.restaurant_lng) },
        title: r.place_name || "",
        icon: makeIcon(false),
        zIndex: 1
      });

      marker.addListener("click", () => {
        // IMPORTANT: selection comes from map, but must not rebuild markers
        onPick?.(r.id);
      });

      markerById.set(Number(r.id), marker);
    }
  }

  // Guard panTo to avoid accidental re-entrancy storms
  let isHighlighting = false;

  function highlightSelected(selectedId, opts = { pan: true }) {
    const map = window.RR_MAP?.getMap?.();
    if (!map) return;

    const id = selectedId == null ? null : Number(selectedId);
    if (id === lastSelectedId) return;

    if (isHighlighting) return;
    isHighlighting = true;
    try {
      // Unselect previous
      if (lastSelectedId != null) {
        const prev = markerById.get(Number(lastSelectedId));
        if (prev) {
          prev.setIcon(makeIcon(false));
          prev.setZIndex(1);
        }
      }

      lastSelectedId = id;

      // Select new
      if (id != null) {
        const m = markerById.get(id);
        if (m) {
          m.setIcon(makeIcon(true));
          m.setZIndex(999);

          if (opts?.pan) {
            const pos = m.getPosition();
            if (pos) map.panTo(pos);
          }
        }
      }
    } finally {
      isHighlighting = false;
    }
  }

  window.RR_MARKERS = { renderMarkers, highlightSelected, clearMarkers };
})();