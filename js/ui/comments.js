(function () {
  const { qs, el } = window.RR_DOM;
  const { dt } = window.RR_FMT;

  function renderComments(comments) {
    const root = qs("#commentsList");
    root.innerHTML = "";

    if (!comments || !comments.length) {
      root.appendChild(el("div", { class: "status", text: "Inga kommentarer ännu." }));
      return;
    }

    for (const c of comments) {
      // comments.js använder: review_id, author_name, author_email, comment, status, created_at
      const name = c.author_name || "Anonym";
      const time = dt(c.created_at);

      root.appendChild(el("div", { class: "comment" }, [
        el("div", { class: "comment__top" }, [
          el("div", { class: "comment__name", text: name }),
          el("div", { class: "comment__time", text: time })
        ]),
        el("div", { class: "comment__body", text: String(c.comment || "") })
      ]));
    }
  }

  async function loadComments(reviewId) {
    const { actions } = window.RR_STATE;
    actions.setNetLoading("comments", true);
    actions.setNetError("comments", null);
    try {
      const rows = await window.RR_API.getComments(reviewId);
      // För public visning vill vi som default bara visa "approved" (om backend patchats).
      // Om backend inte patchats och returnerar allt, filtrera bort rejected här.
      const filtered = rows.filter(r => String(r.status || "").toLowerCase() !== "rejected");
      actions.setComments(reviewId, filtered);
    } catch (e) {
      actions.setNetError("comments", e.message || "Kunde inte hämta kommentarer");
      actions.setComments(reviewId, []);
    } finally {
      actions.setNetLoading("comments", false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const { state, actions } = window.RR_STATE;
    const reviewId = state.ui.selectedReviewId;
    if (!reviewId) return;

    const name = qs("#commentName").value.trim();
    const email = qs("#commentEmail").value.trim();
    const body = qs("#commentBody").value.trim();
    const note = qs("#commentNote");
    const btn = qs("#commentSubmitBtn");

    if (!name || !body) return;

    actions.setNetLoading("postComment", true);
    actions.setNetError("postComment", null);
    note.textContent = "";
    btn.disabled = true;

    try {
      await window.RR_API.postComment({
        reviewId,
        authorName: name,
        authorEmail: email || undefined,
        comment: body
      });

      qs("#commentBody").value = "";
      note.textContent = window.RR_PUBLIC_CONFIG.moderationCopy.posted;

      // refresh
      await loadComments(reviewId);
    } catch (err) {
      const msg = err.message || "Kunde inte skicka kommentar";
      actions.setNetError("postComment", msg);
      note.textContent = msg;
    } finally {
      actions.setNetLoading("postComment", false);
      btn.disabled = false;
    }
  }

  function wireComments() {
    qs("#commentForm").addEventListener("submit", handleSubmit);
  }

  window.RR_UI_COMMENTS = { renderComments, loadComments, wireComments };
})();
