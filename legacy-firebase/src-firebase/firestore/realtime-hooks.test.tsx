import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { onSnapshotMock } = vi.hoisted(() => ({ onSnapshotMock: vi.fn() }));
vi.mock('firebase/firestore', () => ({ onSnapshot: onSnapshotMock }));

import { useCollection } from './use-collection';
import { useDoc } from './use-doc';

type Listener = { next: (snapshot: any) => void; error: (error: any) => void; unsubscribe: ReturnType<typeof vi.fn> };
let listeners: Listener[] = [];

const collectionSnapshot = (value: number) => ({
  docs: [{ id: 'row-1', data: () => ({ value }) }]
});
const documentSnapshot = (value: number) => ({
  id: 'doc-1',
  exists: () => true,
  data: () => ({ value })
});

beforeEach(() => {
  listeners = [];
  onSnapshotMock.mockReset();
  onSnapshotMock.mockImplementation((_source: any, next: Listener['next'], error: Listener['error']) => {
    const listener = { next, error, unsubscribe: vi.fn() };
    listeners.push(listener);
    return listener.unsubscribe;
  });
});

describe('Firestore realtime hook recovery', () => {
  it('clears old rows on query change and restores identical rows from the new source', async () => {
    const { result, rerender } = renderHook(({ source }) => useCollection(source), {
      initialProps: { source: {} as any }
    });

    act(() => listeners[0].next(collectionSnapshot(7)));
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'row-1', value: 7 }]));

    rerender({ source: { differentQuery: true } as any });
    await waitFor(() => expect(listeners).toHaveLength(2));
    await waitFor(() => expect(result.current.data).toBeNull());

    act(() => listeners[1].next(collectionSnapshot(7)));
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'row-1', value: 7 }]));
    expect(listeners[0].unsubscribe).toHaveBeenCalled();
  });

  it('restores collection rows after an error and a fresh listener with the same payload', async () => {
    const { result, rerender } = renderHook(({ source }) => useCollection(source), {
      initialProps: { source: {} as any }
    });
    act(() => listeners[0].next(collectionSnapshot(4)));
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'row-1', value: 4 }]));

    act(() => listeners[0].error({ code: 'unavailable', message: 'offline' }));
    await waitFor(() => expect(result.current.data).toEqual([]));

    rerender({ source: { reconnected: true } as any });
    await waitFor(() => expect(listeners).toHaveLength(2));
    act(() => listeners[1].next(collectionSnapshot(4)));
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'row-1', value: 4 }]));
  });

  it('restores document data after a changed document source reconnects with the same payload', async () => {
    const { result, rerender } = renderHook(({ source }) => useDoc(source), {
      initialProps: { source: { path: 'users/u1' } as any }
    });
    act(() => listeners[0].next(documentSnapshot(9)));
    await waitFor(() => expect(result.current.data).toEqual({ id: 'doc-1', value: 9 }));

    act(() => listeners[0].error({ code: 'unavailable', message: 'offline' }));
    await waitFor(() => expect(result.current.data).toBeNull());

    rerender({ source: { path: 'users/u2' } as any });
    await waitFor(() => expect(listeners).toHaveLength(2));
    act(() => listeners[1].next(documentSnapshot(9)));
    await waitFor(() => expect(result.current.data).toEqual({ id: 'doc-1', value: 9 }));
  });
});
