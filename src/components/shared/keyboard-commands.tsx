'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTerminal } from '@/hooks/use-terminal';
import { toast } from '@/hooks/use-toast';

/**
 * Global Keyboard Command Center
 * Shortcuts for rapid navigation across OS modules.
 * Note: Only active when terminal is UNLOCKED.
 */
export function KeyboardCommands() {
  const router = useRouter();
  const { isLocked } = useTerminal();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleShortcuts = (e: KeyboardEvent) => {
      // Security Gate: No commands allowed if station is locked
      if (isLocked) return;

      // Ignore if user is currently typing in an input or textarea
      const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '');
      if (isTyping) return;

      // Command Key + Mapping
      const isCommand = e.altKey; // Using Alt key for standard OS shortcuts

      if (isCommand) {
        let target = '';
        let label = '';

        switch (e.key.toLowerCase()) {
          case 'd': target = '/dashboard'; label = 'Dashboard'; break;
          case 'l': target = '/lounge'; label = 'Lounge POS'; break;
          case 's': target = '/store'; label = 'Retail Store POS'; break;
          case 'w': target = '/carwash/pos'; label = 'Carwash POS'; break;
          case 'i': target = '/inventory'; label = 'Inventory Catalogue'; break;
          case 'q': target = '/carwash'; label = 'Service Queue'; break;
          case 't': target = '/sales-history'; label = 'Sales Ledger'; break;
          case 'a': target = '/admin'; label = 'Admin Hub'; break;
        }

        if (target) {
          e.preventDefault();
          router.push(target);
          toast({ 
            title: `Navigating to ${label}`,
            description: "Command sequence authorized.",
            duration: 2000
          });
        }
      }
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [router, isLocked]);

  return null;
}
