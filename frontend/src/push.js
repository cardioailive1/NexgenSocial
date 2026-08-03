import { api, API_URL } from "./api";

// VAPID keys arrive base64url-encoded; the browser needs a Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushPermission() {
  return pushSupported() ? Notification.permission : "unsupported";
}

// Registers the service worker and subscribes this browser. Must be called
// from a user gesture -- browsers refuse a permission prompt otherwise, and
// a refused prompt can't be re-requested easily.
export async function enablePush() {
  if (!pushSupported()) {
    return { ok: false, reason: "This browser doesn't support notifications." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "Notifications were blocked. Enable them in your browser's site settings to receive calls when this tab is closed." };
  }

  const { publicKey, configured } = await api.get("/api/push/vapid-key");
  if (!configured || !publicKey) {
    return { ok: false, reason: "Push notifications aren't configured on the server yet." };
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  await api.post("/api/push/subscribe", { endpoint: json.endpoint, keys: json.keys });

  return { ok: true };
}

export async function disablePush() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await api.post("/api/push/unsubscribe", { endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe();
  }
}
