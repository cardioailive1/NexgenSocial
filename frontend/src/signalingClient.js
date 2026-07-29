// Wraps the raw WebSocket in a small request/response RPC helper matching
// the server's protocol (backend/src/livestreamSignaling.js): every request
// gets a unique reqId, and the promise resolves/rejects when a message with
// that reqId comes back. Notifications (no reqId) are handed to whatever
// handler the caller registered via onNotification.
export function createSignalingClient(ws) {
  const pending = new Map();
  let notificationHandler = () => {};

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.notification) {
      notificationHandler(msg.notification, msg.data);
      return;
    }
    const waiter = pending.get(msg.reqId);
    if (!waiter) return;
    pending.delete(msg.reqId);
    if (msg.ok) waiter.resolve(msg.data);
    else waiter.reject(new Error(msg.error || "Signaling request failed."));
  });

  function request(method, data = {}) {
    return new Promise((resolve, reject) => {
      const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      pending.set(reqId, { resolve, reject });
      ws.send(JSON.stringify({ reqId, method, data }));
    });
  }

  function onNotification(handler) {
    notificationHandler = handler;
  }

  return { request, onNotification };
}
