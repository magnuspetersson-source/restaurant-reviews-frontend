<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Restaurant Reviews (Local test)</title>

  <!-- Samma CSS som Squarespace-kodblocket -->
  <link rel="stylesheet" href="https://magnuspetersson-source.github.io/restaurant-reviews-frontend/css/public.css" />
</head>
<body>

  <!-- Samma #app som Squarespace-kodblocket -->
  <div
    id="app"
    data-api-base="https://restaurant-reviews-backend-xi.vercel.app"
  ></div>

  <!--
    Lokal config (IGNORERAS av git):
    Försöker ladda /js/config.local.js (t.ex. http://localhost:3000/js/config.local.js)
    Om den inte finns (prod/Squarespace) så fortsätter vi utan fel.
  -->
  <script>
  (function () {
    function loadScript(src) {
      return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = src;
        s.defer = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    // Försök ladda lokal config först (bara när den finns)
    loadScript("/js/config.local.js")
      .then(function () {
        console.log("[RR] Loaded /js/config.local.js");
      })
      .catch(function () {
        console.log("[RR] No /js/config.local.js (ok in prod)");
      })
      .finally(function () {
        // Ladda exakt samma kedja som Squarespace-kodblocket
        var scripts = [
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/config.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/utils/dom.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/utils/format.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/utils/sanitize.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/api.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/router.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/state.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/map/map.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/map/markers.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/ui/list.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/ui/panel.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/ui/comments.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/ui/slideshowModal.js",
          "https://magnuspetersson-source.github.io/restaurant-reviews-frontend/js/app.js"
        ];

        // Lägg in dem i ordning (defer => körs i ordning)
        scripts.forEach(function (src) {
          var s = document.createElement("script");
          s.src = src;
          s.defer = true;
          document.head.appendChild(s);
        });
      });
  })();
  </script>

</body>
</html>