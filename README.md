# Restaurant Reviews – Frontend

Detta repo innehåller frontend-kod för restaurangrecensionsprojektet.
Koden kan:

- köras via GitHub Pages (för test)
- bäddas in i Squarespace med `<script src="...">`
- prata med backend (Vercel) via `fetch` mot API:erna

Backend-repot finns separat (`restaurant-reviews-backend`).

---

## 📁 Struktur

- `index.html` – publika visningssidan (karta + recensioner)
- `admin.html` – adminsida (testmiljö för dig)
- `js/public.js` – JS-logik för publika sidan
- `js/admin.js` – JS-logik för adminsidan
- `js/config.example.js` – exempelkonfiguration (backend-URL m.m.)
- `css/public.css` – styling för publika sidan
- `css/admin.css` – styling för adminsidan

---

## 🔧 Konfiguration

Skapa en `js/config.js` baserat på `js/config.example.js`:

```js
// js/config.js
window.RR_CONFIG = {
  backendBaseUrl: "https://restaurant-reviews-backend.vercel.app",
};
