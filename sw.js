// Wygenerowane przy budowaniu (vite.config.ts) – nie edytuj ręcznie.
const CACHE = "indeks-0.2.1-1d3830dd";
const ASSETS = ["./index.html","./assets/index-S0DOyVH6.js","./assets/ai-C85fzRe2.js","./assets/error-BTdmRKoB.js","./assets/node.browser-Deyv-lVn.js","./assets/node.browser-HQ5SKBOf.js","./assets/index-DMFvdPC3.css","./assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2","./assets/inter-cyrillic-wght-normal-DqGufNeO.woff2","./assets/inter-greek-ext-wght-normal-DlzME5K_.woff2","./assets/inter-greek-wght-normal-CkhJZR-_.woff2","./assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2","./assets/inter-latin-wght-normal-Dx4kXJAl.woff2","./assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2","./apple-touch-icon.png","./favicon.svg","./icon-192.png","./icon-512.png","./manifest.webmanifest"];
const INDEX = new URL("./index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("indeks-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // USOS, API Claude i inne serwery – zawsze przez sieć.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  // ignoreVary: skrypty modułowe wysyłają nagłówek Origin, a serwer odpowiada z „Vary” – bez tego pamięć nie pasuje.
  if (request.mode === "navigate") {
    event.respondWith(caches.match(INDEX, { ignoreVary: true }).then((hit) => hit || fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, { ignoreVary: true }).then((hit) => hit || fetch(request)));
});
