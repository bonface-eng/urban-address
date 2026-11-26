import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBusinessClock } from './use-business-clock';

describe('useBusinessClock', () => {
  afterEach(() => vi.useRealTimers());

  it('rolls the business-day boundary forward at midnight without a remount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 22, 23, 59, 50));
    const { result } = renderHook(() => useBusinessClock());
    expect(result.current.startOfToday).toBe(new Date(2026, 10, 22, 0, 0, 0, 0).getTime());

    act(() => {
      vi.setSystemTime(new Date(2026, 10, 23, 0, 0, 20));
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.startOfToday).toBe(new Date(2026, 10, 23, 0, 0, 0, 0).getTime());
    expect(result.current.dayOfWeek).toBe(1);
  });

  it('refreshes immediately when the tab regains focus', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 22, 23, 59, 50));
    const { result } = renderHook(() => useBusinessClock());

    act(() => {
      vi.setSystemTime(new Date(2026, 10, 23, 0, 0, 10));
      window.dispatchEvent(new Event('focus'));
    });

    expect(result.current.startOfToday).toBe(new Date(2026, 10, 23, 0, 0, 0, 0).getTime());
  });
});
