/* NOVA LABS service worker — Web Push only.
 *
 * Deliberately does not cache anything. Adding offline caching here would make
 * lesson content and quiz state go stale in ways that are hard to debug; this
 * worker exists solely so the browser can wake it to show a notification.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "NOVA LABS", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "NOVA LABS";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Collapses repeats of the same kind rather than stacking them.
      tag: data.tag || title,
      data: { url: data.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";

  // Focus an existing tab if one is open rather than piling up new ones.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
