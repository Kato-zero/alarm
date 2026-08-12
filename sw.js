const CACHE_NAME = "alarm-clock-v1";
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Page asks the service worker to show a notification (works even if the
// page/tab is hidden or minimized, as long as the browser is still running).
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "SHOW_ALARM_NOTIFICATION") return;

  const { alarmId, title, body } = data;
  self.registration.showNotification(title || "Alarm", {
    body: body || "",
    tag: "alarm-" + alarmId,
    requireInteraction: true,
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: { alarmId },
    actions: [
      { action: "snooze", title: "Snooze 5 min" },
      { action: "dismiss", title: "Dismiss" }
    ]
  });
});

// Handle taps on the notification itself, or on its Snooze/Dismiss buttons.
self.addEventListener("notificationclick", (event) => {
  const alarmId = event.notification.data && event.notification.data.alarmId;
  const action = event.action || "open";
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({ type: "NOTIFICATION_ACTION", action, alarmId });
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(`./index.html?action=${action}&alarmId=${alarmId || ""}`);
      }
    })
  );
});
