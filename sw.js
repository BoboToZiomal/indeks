// Wygenerowane przy budowaniu (vite.config.ts) – nie edytuj ręcznie.
const CACHE = "indeks-0.7.0-d9666800";
const ASSETS = ["./index.html","./assets/index-91kcwqUE.js","./assets/ai-CwRfn2HI.js","./assets/error-BTdmRKoB.js","./assets/firebase-DctGCmof.js","./assets/node.browser-CVogbJvd.js","./assets/node.browser-HQ5SKBOf.js","./assets/bricolage-grotesque-latin-ext-opsz-normal-IcJDqblK.woff2","./assets/bricolage-grotesque-latin-opsz-normal-Cre6nC2_.woff2","./assets/bricolage-grotesque-vietnamese-opsz-normal-D9N6E8K1.woff2","./assets/index-L9NIPwx6.css","./apple-touch-icon.png","./favicon.svg","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./manifest.webmanifest"];
const INDEX = new URL("./index.html", self.registration.scope).href;
// Strona główna Indeksu (strona/, scripts/deploy-site.mjs) leży w zasięgu workera, ale nie jest aplikacją: jej adresy
// idą zawsze prosto do sieci. Starsze workery podawały w jej miejscu aplikację, która pod strona/ wczytuje się pusta.
// SITE_MARK (bez przedrostka „indeks-”, więc activate go nie usuwa) znaczy, że działał już worker, który to wie.
const SITE = new URL("./strona/", self.registration.scope).href;
const SITE_MARK = "indeks:strona";
const onSite = (url) => (url.split(/[?#]/)[0] + "/").startsWith(SITE);
let repairing = false;
let reloadSite = false;

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
        return;
      }
      // Otwarta jest tylko strona główna: żadnemu oknu aplikacji zmiana nie przeszkodzi, więc nowa wersja działa od razu.
      const open = (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).filter((client) =>
        client.url.startsWith(self.registration.scope),
      );
      if (open.length && open.every((client) => onSite(client.url))) {
        reloadSite = !(await caches.has(SITE_MARK));
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
      await caches.open(SITE_MARK);
      await self.clients.claim();
      if (!repairing && !reloadSite) return;
      const windows = await self.clients.matchAll({ type: "window" });
      // Bez await: nawigacja potrzebuje zdarzenia fetch, a ono czeka na koniec aktywacji – await to zakleszczenie.
      windows
        .filter((client) => repairing || onSite(client.url))
        .forEach((client) => client.navigate(client.url).catch(() => {}));
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
  // Strona główna – zawsze przez sieć, bez pamięci aplikacji.
  if (onSite(request.url)) return;
  // ignoreVary: skrypty modułowe wysyłają nagłówek Origin, a serwer odpowiada z „Vary” – bez tego pamięć nie pasuje.
  if (request.mode === "navigate") {
    event.respondWith(caches.match(INDEX, { ignoreVary: true }).then((hit) => hit || fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, { ignoreVary: true }).then((hit) => hit || fetch(request)));
});
