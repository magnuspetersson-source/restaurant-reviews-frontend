(function () {
  function dollars(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return "";
    return "$".repeat(Math.max(1, Math.min(5, Math.round(x))));
  }

  function stars(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return "";
    const r = Math.max(0, Math.min(5, Math.round(x)));
    return "★".repeat(r) + "☆".repeat(5 - r);
  }

  function km(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "";
    return `${x.toFixed(1).replace(".", ",")} km`;
  }

  function dt(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("sv-SE", { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  }

  window.RR_FMT = { dollars, stars, km, dt };
})();
