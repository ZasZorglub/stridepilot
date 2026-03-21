"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSessionToken = createSessionToken;
exports.verifySessionToken = verifySessionToken;
exports.getCurrentSession = getCurrentSession;
exports.getSessionCookieName = getSessionCookieName;
exports.getSessionMaxAge = getSessionMaxAge;
const node_crypto_1 = __importDefault(require("node:crypto"));
const headers_1 = require("next/headers");
const COOKIE_NAME = "rc_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30;
function toBase64Url(value) {
    return Buffer.from(value)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}
function fromBase64Url(value) {
    const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64");
}
function getSecret() {
    const secret = process.env.AUTH_SECRET;
    if (!secret)
        throw new Error("AUTH_SECRET is not configured");
    return secret;
}
function sign(raw) {
    return toBase64Url(node_crypto_1.default.createHmac("sha256", getSecret()).update(raw).digest());
}
function createSessionToken(userId, email) {
    const payload = {
        userId,
        email,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
    };
    const body = toBase64Url(JSON.stringify(payload));
    const signature = sign(body);
    return `${body}.${signature}`;
}
function verifySessionToken(token) {
    const [body, signature] = token.split(".");
    if (!body || !signature)
        return null;
    const expected = sign(body);
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !node_crypto_1.default.timingSafeEqual(left, right)) {
        return null;
    }
    try {
        const payload = JSON.parse(fromBase64Url(body).toString("utf-8"));
        if (payload.exp < Math.floor(Date.now() / 1000))
            return null;
        if (!payload.userId || !payload.email)
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
async function getCurrentSession() {
    const cookieStore = await (0, headers_1.cookies)();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token)
        return null;
    return verifySessionToken(token);
}
function getSessionCookieName() {
    return COOKIE_NAME;
}
function getSessionMaxAge() {
    return SESSION_TTL_SEC;
}
