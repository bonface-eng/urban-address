'use client';

import { useEffect, useRef } from 'react';

/**
 * useBarcodeScanner
 * Detects HID keyboard input from an industrial barcode scanner.
 * Optimised with speed-gating to prevent manual typing from triggering scans.
 */
export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Gate 1: Ignore functional/modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;
      
      // Industrial scanners type at < 30ms per character
      // Human typing is rarely consistent below 80ms
      const isHighSpeedInput = timeDiff < 40;
      lastKeyTime.current = currentTime;

      // Gate 2: Suffix Detection (Standard scanners end with 'Enter')
      if (e.key === 'Enter') {
        const result = buffer.current.trim();
        if (result.length >= 4) {
          onScan(result);
        }
        buffer.current = '';
        return;
      }

      // Gate 3: High-speed buffering
      if (e.key.length === 1) {
        // If the gap between keys is too large, it's a human. Flush buffer.
        if (!isHighSpeedInput && buffer.current.length > 0) {
          buffer.current = '';
        }
        buffer.current += e.key;
      }

      // Cleanup runaway buffers
      if (buffer.current.length > 32) {
        buffer.current = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan]);
}
