// Retires the service worker the dashboard used to register at the site root.
// The dashboard now lives under dashboard/ with its own worker; without this file a
// browser that installed the old one would keep serving the old dashboard shell at the
// root instead of the landing page. It removes only caches created for the root scope,
// unregisters itself, and reloads open pages once so they load from the network.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) {
  var scope = self.registration.scope;
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.indexOf(scope) !== -1 && k.indexOf(scope + "dashboard/") === -1; })
      .map(function (k) { return caches.delete(k); }));
    await self.registration.unregister();
    var clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(function (c) { c.navigate(c.url); });
  })());
});
