// list.js
(function () {
  function renderList(reviews, selectedId, onPick) {
    const listEl = document.getElementById("reviewList");
    if (!listEl) return;

    listEl.innerHTML = "";

    (reviews || []).forEach((r) => {
      const card = document.createElement("div");
      card.className = "card" + (Number(r.id) === Number(selectedId) ? " is-selected" : "");
      card.innerHTML = `
        <div class="card__title">${r.place_name || ""}</div>
      `;

      card.addEventListener("click", () => onPick?.(r.id, "list"));
      listEl.appendChild(card);
    });
  }

  window.RR_LIST = { renderList };
})();