"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSpeechSupported = isSpeechSupported;
exports.initSpeech = initSpeech;
exports.cancelCue = cancelCue;
exports.speakCue = speakCue;
let initialized = false;
function isSpeechSupported() {
    return typeof window !== "undefined" && Boolean(window.speechSynthesis);
}
function initSpeech() {
    if (!isSpeechSupported())
        return false;
    initialized = true;
    window.speechSynthesis.getVoices();
    return true;
}
function cancelCue() {
    if (!isSpeechSupported())
        return;
    window.speechSynthesis.cancel();
}
function speakCue(text) {
    if (!initialized || !isSpeechSupported())
        return false;
    try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "da-DK";
        utterance.rate = 1;
        utterance.pitch = 1;
        cancelCue();
        window.speechSynthesis.speak(utterance);
        return true;
    }
    catch {
        // Silent fallback for unsupported browsers.
        return false;
    }
}
