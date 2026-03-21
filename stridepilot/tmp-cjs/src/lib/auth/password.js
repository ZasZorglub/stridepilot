"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const node_crypto_1 = __importDefault(require("node:crypto"));
const SCRYPT_KEYLEN = 64;
function hashPassword(password) {
    const salt = node_crypto_1.default.randomBytes(16).toString("hex");
    const derived = node_crypto_1.default.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
    return `scrypt:${salt}:${derived}`;
}
function verifyPassword(password, stored) {
    const [algo, salt, expected] = stored.split(":");
    if (algo !== "scrypt" || !salt || !expected)
        return false;
    const derived = node_crypto_1.default.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
    const left = Buffer.from(derived, "hex");
    const right = Buffer.from(expected, "hex");
    if (left.length !== right.length)
        return false;
    return node_crypto_1.default.timingSafeEqual(left, right);
}
