'use client';

import { useEffect, useRef } from 'react';

/**
 * useCardReader
 * Detects HID keyboard input from a Magnetic Stripe Reader (MSR).
 * Supports ISO 7813 Bank Cards (Track 1/2) and Internal Loyalty Cards.
 */
export function useCardReader(onRead: (data: any) => void) {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;
      const isFastInput = timeDiff < 50;
      lastKeyTime.current = currentTime;

      if (e.key === 'Enter') {
        const raw = buffer.current.trim();
        
        if (raw.length > 5) {
          // 1. Check for ISO Bank Card (Track 1 or 2)
          // Track 1 usually starts with %B and contains ^ separators
          // Track 2 usually starts with ; and contains = separators
          const isBankCard = (raw.startsWith('%B') || raw.startsWith(';'));

          if (isBankCard) {
            const parsed = parseBankCard(raw);
            if (parsed) {
              onRead({ type: 'BANK_CARD', ...parsed });
            }
          } else {
            // 2. Fallback to Loyalty/Internal ID
            const cleanId = raw.replace(/[%;?+]/g, '').split('=')[0].trim();
            onRead({ type: 'LOYALTY', id: cleanId, raw });
          }
        }
        
        buffer.current = '';
        return;
      }

      if (e.key.length === 1) {
        if (!isFastInput && buffer.current.length > 0) {
          buffer.current = '';
        }
        buffer.current += e.key;
      }

      if (buffer.current.length > 256) buffer.current = '';
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRead]);
}

/**
 * Robust Bank Card Parser (MSR ISO 7813)
 */
function parseBankCard(raw: string) {
  try {
    // Track 2 Parsing (Most common for simple MSRs)
    // Format: ;[PAN]=[EXPIRY][SERVICE_CODE][PVV][DISCRETIONARY]?
    if (raw.includes(';')) {
      const track2 = raw.split(';')[1].split('?')[0];
      const [pan, rest] = track2.split('=');
      const expiry = rest?.substring(0, 4); // YYMM
      
      return {
        pan: pan,
        maskedPan: `**** **** **** ${pan.slice(-4)}`,
        expiry: expiry ? `${expiry.substring(2)}/${expiry.substring(0, 2)}` : null,
        vendor: pan.startsWith('4') ? 'VISA' : pan.startsWith('5') ? 'MASTERCARD' : 'UNKNOWN'
      };
    }

    // Track 1 Parsing
    // Format: %B[PAN]^[NAME]^[EXPIRY]...
    if (raw.startsWith('%B')) {
      const track1 = raw.split('%B')[1].split('?')[0];
      const parts = track1.split('^');
      const pan = parts[0];
      const expiry = parts[2]?.substring(0, 4);

      return {
        pan: pan,
        maskedPan: `**** **** **** ${pan.slice(-4)}`,
        expiry: expiry ? `${expiry.substring(2)}/${expiry.substring(0, 2)}` : null,
        vendor: pan.startsWith('4') ? 'VISA' : pan.startsWith('5') ? 'MASTERCARD' : 'UNKNOWN'
      };
    }
  } catch (err) {
    console.error('MSR Parsing Error:', err);
  }
  return null;
}
