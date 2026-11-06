// Wygenerowane przy budowaniu (vite.config.ts) – nie edytuj ręcznie.
const CACHE = "indeks-0.6.2-cf286d88";
const ASSETS = ["./index.html","./assets/index-DGbMktzp.js","./assets/ai-xQU_rX4o.js","./assets/error-BTdmRKoB.js","./assets/firebase-DAyI1Y6i.js","./assets/node.browser-C9JJihnx.js","./assets/node.browser-HQ5SKBOf.js","./assets/index-Ca6IXySg.css","./assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2","./assets/inter-cyrillic-wght-normal-DqGufNeO.woff2","./assets/inter-greek-ext-wght-normal-DlzME5K_.woff2","./assets/inter-greek-wght-normal-CkhJZR-_.woff2","./assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2","./assets/inter-latin-wght-normal-Dx4kXJAl.woff2","./assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2","./apple-touch-icon.png","./favicon.svg","./icon-192.png","./icon-512.png","./manifest.webmanifest"];
const INDEX = new URL("./index.html", self.registration.scope).href;
let repairing = false;

// Wersje do 0.2.2 mogły zapisać stary index.html, który wskazuje pliki usunięte już z serwera – aplikacja
// otwierała się wtedy pusta i nie mogła pokazać komunikatu o aktualizacji. Taką wersję zastępujemy od razu.
async function runningVersionBroken() {
  for (const key of await caches.keys()) {
    if (!key.startsWith("indeks-") || key === CACHE) continue;
    const cache = await caches.open(key);
    const html = await cache.match(INDEX, { ignoreVary: true });
    if (!html) return true;
    const files = (await html.text()).match(/assets\/[^"']+/g) ?? [];
    for (const file of files) {
      const hit = await cache.match(new URL(file, self.registration.scope).href, { ignoreVary: true });
      if (!hit) return true;
    }
  }
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // cache: "reload" – prosto z serwera. Pamięć przeglądarki (GitHub Pages: max-age=600) mogłaby oddać stare pliki.
      await cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" })));
      if (await runningVersionBroken()) {
        repairing = true;
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("indeks-") && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
      if (!repairing) return;
      const windows = await self.clients.matchAll({ type: "window" });
      // Bez await: nawigacja potrzebuje zdarzenia fetch, a ono czeka na koniec aktywacji – await to zakleszczenie.
      windows.forEach((client) => client.navigate(client.url).catch(() => {}));
    })(),
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
