(function () {
  let markers = [];
  let markerById = {};

  function clearMarkers() {
    for (const m of markers) m.setMap(null);
    markers = [];
    markerById = {};
  }

  function makeIcon(selected) {
    // Google default pin-ish (red) via SymbolPath (stabilt utan externa assets)
    const scale = selected ? 10 : 7;
    return {
      path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
      scale,
      fillColor: "#EA4335",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 1.2
    };
  }

  function fitTo(markersList, map) {
    const pts = markersList
      .map(m => m.getPosition())
      .filter(Boolean);

    if (!pts.length) return;

    const bounds = new google.maps.LatLngBounds();
    pts.forEach(p => bounds.extend(p));
    map.fitBounds(bounds, 60);
  }

  function renderMarkers(reviews, selectedId, onPick) {
    const map = window.RR_MAP.getMap();
    if (!map || !window.google || !google.maps) return;

    clearMarkers();

    for (const r of reviews) {
      const lat = Number(r.restaurant_lat);
      const lng = Number(r.restaurant_lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const isSelected = (r.id === selectedId);

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        title: r.place_name || "",
        icon: makeIcon(isSelected),
        zIndex: isSelected ? 999 : 1
      });

      marker.addListener("click", () => onPick(r.id));
      markers.push(marker);
      markerById[r.id] = marker;
    }

    fitTo(markers, map);
  }

  function highlightSelected(selectedId) {
    for (const [idStr, marker] of Object.entries(markerById)) {
      const id = Number(idStr);
      const isSelected = id === selectedId;
      marker.setIcon(makeIcon(isSelected));
      marker.setZIndex(isSelected ? 999 : 1);
      if (isSelected) {
        const map = window.RR_MAP.getMap();
        const pos = marker.getPosition();
        if (map && pos) map.panTo(pos);
      }
    }
  }

  window.RR_MARKERS = { renderMarkers, highlightSelected };
})();
