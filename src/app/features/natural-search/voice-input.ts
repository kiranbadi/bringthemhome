import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject } from '@angular/core';

export interface VoiceInput {
  start(): void;
  abort(): void;
  onresult: ((text: string) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
interface BrowserRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((event: {
        results: { [index: number]: { [index: number]: { transcript: string } } };
      }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
export const VOICE_INPUT = new InjectionToken<(() => VoiceInput) | null>('Browser voice input', {
  providedIn: 'root',
  factory: () => {
    const browser = inject(DOCUMENT).defaultView as
      | (Window & {
          SpeechRecognition?: new () => BrowserRecognition;
          webkitSpeechRecognition?: new () => BrowserRecognition;
        })
      | null;
    const Recognition = browser?.SpeechRecognition || browser?.webkitSpeechRecognition;
    if (!Recognition) return null;
    return () => {
      const recognition = new Recognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.continuous = false;
      const voice: VoiceInput = {
        start: () => recognition.start(),
        abort: () => recognition.abort(),
        onresult: null,
        onerror: null,
        onend: null,
      };
      recognition.onresult = (event) => voice.onresult?.(event.results[0][0].transcript);
      recognition.onerror = () => voice.onerror?.();
      recognition.onend = () => voice.onend?.();
      return voice;
    };
  },
});
