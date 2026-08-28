/* Alyssa Growth OS Web Push service worker. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "Alyssa Growth OS",
      body: event.data ? event.data.text() : "你有一項新工作更新。",
    };
  }

  const title = payload.title || "Alyssa Growth OS";
  const options = {
    body: payload.body || "你有一項新工作更新。",
    tag: payload.tag || `growth-os-${Date.now()}`,
    icon: payload.icon || "/icons/growth-os-192.png",
    badge: payload.badge || "/icons/growth-os-192.png",
    renotify: false,
    requireInteraction: Boolean(payload.requireInteraction),
    actions: [{ action: "open", title: "開啟工作" }],
    data: {
      url: payload.url || "/tasks",
      notificationId: payload.notificationId || null,
      type: payload.type || "update",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const relativeUrl = event.notification.data?.url || "/tasks";
  const targetUrl = new URL(relativeUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        const sameOriginWindow = windows.find((client) => {
          try {
            return new URL(client.url).origin === self.location.origin;
          } catch {
            return false;
          }
        });
        if (sameOriginWindow) {
          if ("navigate" in sameOriginWindow) {
            await sameOriginWindow.navigate(targetUrl);
          }
          return sameOriginWindow.focus();
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
