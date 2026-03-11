self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = { title: "StridePilot", body: "Træningspåmindelse", url: "/" };

  try {
    payload = event.data.json();
  } catch {
    // ignore parse errors and use defaults
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "StridePilot", {
      body: payload.body || "Træningspåmindelse",
      icon: "/next.svg",
      badge: "/next.svg",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
      return undefined;
    }),
  );
});
