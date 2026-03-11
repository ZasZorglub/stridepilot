let initialized = false;

export function isSpeechSupported() {
  return typeof window !== "undefined" && Boolean(window.speechSynthesis);
}

export function initSpeech() {
  if (!isSpeechSupported()) return false;
  initialized = true;
  window.speechSynthesis.getVoices();
  return true;
}

export function cancelCue() {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}

export function speakCue(text: string) {
  if (!initialized || !isSpeechSupported()) return false;

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "da-DK";
    utterance.rate = 1;
    utterance.pitch = 1;
    cancelCue();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    // Silent fallback for unsupported browsers.
    return false;
  }
}
