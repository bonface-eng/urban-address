
'use client';

import { logger } from './logger';

/**
 * JARVIS Auditory Interface v2.0
 * Features: Wake-word detection, continuous listening, and neural vocalization.
 */
class VoiceSystem {
  private synthesis: SpeechSynthesis | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private recognition: any = null;
  private isListening: boolean = false;
  private onResultCallback: ((text: string) => void) | null = null;
  private onWakeWordCallback: (() => void) | null = null;
  
  private wakeWords: string[] = ['jarvis', 'hey jarvis', 'computer'];

  constructor() {
    if (typeof window !== 'undefined') {
      this.synthesis = window.speechSynthesis;
      this.initVoice();
      this.initRecognition();
    }
  }

  private initVoice() {
    if (!this.synthesis) return;
    const voices = this.synthesis.getVoices();
    this.voice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Male')) || voices[0];
    
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = () => {
        const updatedVoices = this.synthesis!.getVoices();
        this.voice = updatedVoices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Male')) || updatedVoices[0];
      };
    }
  }

  private initRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      logger.warn('Neural recognition not supported in this environment.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true; 
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentText = (finalTranscript || interimTranscript).toLowerCase().trim();

      // Wake word check
      if (this.wakeWords.some(word => currentText.includes(word))) {
        if (this.onWakeWordCallback) {
          this.onWakeWordCallback();
        }
      }

      if (finalTranscript && this.onResultCallback) {
        this.onResultCallback(finalTranscript);
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        logger.error('Auditory Interface Error:', event.error);
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        try {
          this.recognition.start();
        } catch (e) {
          // Restarting
        }
      }
    };
  }

  speak(text: string, pitch = 1.0, rate = 1.0) {
    if (!this.synthesis) return;

    this.synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) utterance.voice = this.voice;
    utterance.pitch = pitch;
    utterance.rate = rate;
    
    this.synthesis.speak(utterance);
    logger.info('JARVIS Vocalizing:', text);
  }

  startListening(onResult: (text: string) => void, onWakeWord?: () => void) {
    if (!this.recognition) return;
    this.onResultCallback = onResult;
    this.onWakeWordCallback = onWakeWord || null;
    this.isListening = true;
    try {
      this.recognition.start();
      logger.info('Auditory Interface: Passive Wake-Word Mode Active');
    } catch (e) {
      // Already active
    }
  }

  stopListening() {
    if (!this.recognition) return;
    this.isListening = false;
    this.recognition.stop();
    logger.info('Auditory Interface: Standby');
  }

  async getDevices() {
    if (typeof navigator === 'undefined') return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
  }
}

export const jarvisVoice = new VoiceSystem();
