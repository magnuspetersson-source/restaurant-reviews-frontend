// js/public.js
// Logik för publika visningssidan (hämtar recensioner)

(function () {
  const cfg = window.RR_CONFIG || {};
  const baseUrl = cfg.backendBaseUrl;

  const reviewsContainer = document.getElementById("reviews");

  if (!baseUrl) {
    console.error("[public] Saknar backendBaseUrl i RR_CONFIG");
    if (reviewsContainer) {
      reviewsContainer.innerHTML =
        "<p>Konfiguration saknas (backendBaseUrl). Kontrollera js/config.js.</p>";
    }
    return; // Avbryt om vi inte har backend-url
  }

  console.log("[public] Backend base URL:", baseUrl);

  function renderReviews(reviews) {
    if (!reviewsContainer) return;

    if (!reviews || reviews.length === 0) {
      reviewsContainer.innerHTML = "<p>Inga recensioner ännu.</p>";
      return;
    }

    const list = document.createElement("div");
    list.className = "reviews-list";

    reviews.forEach((rev) => {
      const item = document.createElement("article");
      item.className = "review-item";

      item.innerHTML = `
        <h2>${rev.place_name || "Okänd restaurang"}</h2>
        <p><strong>Betyg:</strong> ${rev.rating ?? "–"}/5</p>
        ${
          rev.restaurant_type
            ? `<p><strong>Typ:</strong> ${rev.restaurant_type}</p>`
            : ""
        }
        ${
          rev.cost_level
            ? `<p><strong>Kostnad:</strong> ${"💰".repeat(
                rev.cost_level
              )}</p>`
            : ""
        }
        ${
          rev.value_rating
            ? `<p><strong>Prisvärdhet:</strong> ${rev.value_rating}/5</p>`
            : ""
        }
        ${
          rev.home_distance_km
            ? `<p><strong>Avstånd hemifrån:</strong> ${rev.home_distance_km.toFixed(
                1
              )} km</p>`
            : ""
        }
        <div class="review-comment">
          ${rev.comment || ""}
        </div>
      `;

      list.appendChild(item);
    });

    reviewsContainer.innerHTML = "";
    reviewsContainer.appendChild(list);
  }

  async function loadReviews() {
    try {
      const url = `${baseUrl}/api/reviews`;
      console.log("[public] Hämtar:", url);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Kunde inte hämta recensioner");
      const data = await res.json();
      console.log("[public] Reviews:", data);
      renderReviews(data);
    } catch (err) {
      console.error("[public] loadReviews error:", err);
      if (reviewsContainer) {
        reviewsContainer.innerHTML =
          "<p>Kunde inte ladda recensioner just nu.</p>";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadReviews();
  });
})();