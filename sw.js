// Offline support for Glovebox Garage.
// The app files are cached on install; pages are served from the cache and
// refreshed in the background, so the app opens instantly and works offline.
// Bump VERSION whenever the app files change.
var VERSION = "gg-2026-10-18";
var CORE = ["./", "./index.html"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  // the VIN and recall lookups must always be live
  if (/nhtsa\.(dot\.)?gov$/.test(url.hostname)) return;
  var sameOrigin = url.origin === self.location.origin;
  // Leave the icons and the install manifest to the browser. iOS loads the
  // Home Screen icon itself and can fall back to a letter if a service
  // worker answers that request.
  if (sameOrigin && (/\.png$|\.svg$/.test(url.pathname) || /manifest\.webmanifest$/.test(url.pathname))) return;
  var isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return;
  e.respondWith(caches.open(VERSION).then(function (cache) {
    return cache.match(req, { ignoreSearch: sameOrigin }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      }).catch(function () {
        // offline and not cached: fall back to the app for page loads
        return hit || (req.mode === "navigate" ? cache.match("./index.html") : undefined);
      });
      // fonts never change, so use the cached copy when there is one
      if (hit && isFont) return hit;
      return hit || net;
    });
  }));
});
