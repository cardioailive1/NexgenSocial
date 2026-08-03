// Service worker for Web Push. Runs independently of any open tab, which
// is what lets a call notification arrive when the site isn't on screen.
//
// It cannot run when the browser itself is fully closed -- that's a
// platform limit, not a bug.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); } catch { return; }

  const isCall = payload.type === "incoming-call";

  const options = {
    body: payload.body || "",
    icon: "/logo.jpg",
    badge: "/logo.jpg",
    data: { url: payload.url || "/" },
    // Calls interrupt; messages shouldn't. requireInteraction keeps a call
    // notification on screen until it's acted on rather than auto-dismissing
    // after a few seconds.
    requireInteraction: isCall,
    tag: isCall ? `call-${payload.callId}` : undefined,
    vibrate: isCall ? [300, 150, 300, 150, 300] : [150],
    actions: isCall
      ? [{ action: "answer", title: "Answer" }, { action: "decline", title: "Decline" }]
      : [],
  };

  event.waitUntil(self.registration.showNotification(payload.title || "NexgenSocial", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "decline") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Reuse an existing tab if there is one, rather than piling up a new
      // window every time someone taps a notification.
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
