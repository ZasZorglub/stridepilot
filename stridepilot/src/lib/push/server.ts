import webpush from "web-push";

let configured = false;

export function getVapidPublicKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}

export function canSendWebPush(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export function ensureWebPushConfigured() {
  if (configured) return;
  if (!canSendWebPush()) {
    throw new Error("Missing VAPID env vars");
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  configured = true;
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: Record<string, unknown>,
) {
  ensureWebPushConfigured();
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
