(function () {
  function getSelectedId() {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("id");
    if (!id) return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }

  function setSelectedId(id) {
    const url = new URL(window.location.href);
    if (id === null || id === undefined) url.searchParams.delete("id");
    else url.searchParams.set("id", String(id));
    window.history.replaceState({}, "", url.toString());
  }

  window.RR_ROUTER = { getSelectedId, setSelectedId };
})();
