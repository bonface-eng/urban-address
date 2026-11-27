import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FirebaseErrorListener } from './FirebaseErrorListener';
const m = vi.hoisted(() => ({ toast: vi.fn(), handler: null as any, off: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ toast: m.toast }));
vi.mock('@/firebase/error-emitter', () => ({ errorEmitter: { on: (_name: string, callback: any) => { m.handler = callback; }, off: m.off } }));
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('permission references without sensitive data', () => {
  it('identifies collection and operation, never document ID or request payload', () => {
    render(<FirebaseErrorListener />);
    m.handler({ context: { path: 'admins/private@example.com', operation: 'get', requestResourceData: { secret: 'private-value' } } });
    expect(m.toast.mock.calls[0][0].description).toContain('ACCESS_ADMINS_GET');
    expect(JSON.stringify(m.toast.mock.calls)).not.toMatch(/private@example.com|private-value/);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private@example.com|private-value/);
  });
  it('does not suppress genuine unknown-collection denials', () => {
    render(<FirebaseErrorListener />); m.handler({ context: { path: 'private-collection/sensitive', operation: 'list' } });
    expect(m.toast.mock.calls[0][0].description).toContain('ACCESS_PROTECTED-DATA_LIST');
    expect(m.toast.mock.calls[0][0].variant).toBe('destructive');
  });
  it('retains held-bill failure warning', () => {
    render(<FirebaseErrorListener />); m.handler({ context: { path: 'users/id/held_bills/bill', operation: 'write' } });
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sync Interrupted' }));
  });
});
