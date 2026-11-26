'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Keeps local business-day boundaries current for pages left open across
 * midnight, and refreshes immediately when the tab regains focus.
 */
export function useBusinessClock() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return useMemo(() => {
    const current = new Date(now);
    const startOfToday = new Date(current);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(current.getFullYear(), current.getMonth(), 1).getTime();
    return {
      now,
      startOfToday: startOfToday.getTime(),
      startOfMonth,
      dayOfWeek: current.getDay()
    };
  }, [now]);
}
