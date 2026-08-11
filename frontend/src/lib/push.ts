import api from "@/lib/api";

/** Web Push keys arrive base64url from the API but the browser wants raw bytes.
 *  Returns an ArrayBuffer: `applicationServerKey` rejects a Uint8Array whose
 *  backing buffer TypeScript cannot prove is a plain ArrayBuffer. */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

/** Browser-level support. Safari only gained this on iOS 16.4, and only for
 *  installed web apps, so this is genuinely false for some learners. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Ask permission, subscribe, and register with the API.
 *  Returns a reason string on failure so the caller can say what went wrong. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "This browser can't show notifications." };

  const { data } = await api.get("/me/push/key");
  if (!data.enabled || !data.public_key) {
    return { ok: false, reason: "Notifications aren't configured on the server yet." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      reason:
        permission === "denied"
          ? "Notifications are blocked for this site. Allow them in your browser settings."
          : "Notification permission wasn't granted.",
    };
  }

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(data.public_key),
    }));

  const json = sub.toJSON();
  await api.post("/me/push/subscribe", {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  });

  return { ok: true };
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  // Tell the API first: if unsubscribing locally succeeds but the call fails,
  // the server would keep pushing to an endpoint that no longer exists.
  await api.delete(`/me/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`);
  await sub.unsubscribe();
}
