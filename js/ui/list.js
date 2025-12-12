(function () {
  const { qs, el } = window.RR_DOM;
  const { dollars, stars, km } = window.RR_FMT;

  function renderTypeOptions(allReviews) {
    const typeSelect = qs("#typeSelect");
    const set = new Set();
    allReviews.forEach(r => {
      if (r.restaurant_type) set.add(String(r.restaurant_type).trim());
    });
    const types = Array.from(set).sort((a,b) => a.localeCompare(b, "sv"));

    // keep first option (Alla)
    while (typeSelect.options.length > 1) typeSelect.remove(1);
    types.forEach(t => typeSelect.appendChild(el("option", { value: t, text: t })));
  }

  function renderList(list, selectedId) {
    const root = qs("#reviewList");
    root.innerHTML = "";

    for (const r of list) {
      const thumbUrl = r.images && r.images[0] ? r.images[0].url : "";
      const thumb = el("div", { class: "thumb" }, [
        thumbUrl ? el("img", { src: thumbUrl, alt: "" }) : el("div", { class: "thumb__ph", text: "🍽️" })
      ]);

      const meta = [];
      if (r.rating) meta.push(el("span", { class: "badge", text: stars(r.rating) }));
      if (r.cost_level) meta.push(el("span", { class: "badge", text: dollars(r.cost_level) }));
      if (r.value_rating) meta.push(el("span", { class: "badge", text: `Value ${r.value_rating}/5` }));
      if (r.home_distance_km !== null && r.home_distance_km !== undefined) meta.push(el("span", { class: "badge", text: km(r.home_distance_km) }));
      if (r.restaurant_type) meta.push(el("span", { class: "badge", text: r.restaurant_type }));

      const card = el("div", {
        class: `card ${r.id === selectedId ? "is-selected" : ""}`,
        role: "button",
        tabindex: "0",
        "data-id": r.id
      }, [
        thumb,
        el("div", { class: "card__main" }, [
          el("div", { class: "card__title", text: r.place_name || "(Namnlös)" }),
          el("div", { class: "card__meta" }, meta)
        ])
      ]);

      card.addEventListener("click", () => window.RR_STATE.actions.selectReview(r.id));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") window.RR_STATE.actions.selectReview(r.id);
      });

      root.appendChild(card);
    }
  }

  window.RR_UI_LIST = { renderTypeOptions, renderList };
})();
