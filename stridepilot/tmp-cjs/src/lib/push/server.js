"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVapidPublicKey = getVapidPublicKey;
exports.canSendWebPush = canSendWebPush;
exports.ensureWebPushConfigured = ensureWebPushConfigured;
exports.sendPushNotification = sendPushNotification;
const web_push_1 = __importDefault(require("web-push"));
let configured = false;
function getVapidPublicKey() {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}
function canSendWebPush() {
    return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY &&
        process.env.VAPID_SUBJECT);
}
function ensureWebPushConfigured() {
    if (configured)
        return;
    if (!canSendWebPush()) {
        throw new Error("Missing VAPID env vars");
    }
    web_push_1.default.setVapidDetails(process.env.VAPID_SUBJECT, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    configured = true;
}
async function sendPushNotification(subscription, payload) {
    ensureWebPushConfigured();
    await web_push_1.default.sendNotification(subscription, JSON.stringify(payload));
}
