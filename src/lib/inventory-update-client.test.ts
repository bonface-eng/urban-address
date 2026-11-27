import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { saveInventoryUpdate } from './inventory-update-client';
const fetcher = vi.fn();
const getIdToken = vi.fn();
const user = { getIdToken } as unknown as User;
beforeEach(() => { vi.clearAllMocks(); getIdToken.mockResolvedValue('token'); vi.stubGlobal('fetch', fetcher); });
afterEach(() => vi.unstubAllGlobals());
describe('inventory update transport', () => {
  it('requires a signed-in account', async () => {
    await expect(saveInventoryUpdate(null, {})).rejects.toThrow('INVENTORY_AUTH_REQUIRED'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('sends fresh authenticated requests and only accepts acknowledged success', async () => {
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ success: true, stockLevel: 25 }) });
    expect(await saveInventoryUpdate(user, { id: 'a', action: 'adjust', delta: 1 })).toMatchObject({ success: true });
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
  });
  it('does not retry after a lost response or claim a write failed definitively', async () => {
    fetcher.mockRejectedValue(new Error('network'));
    await expect(saveInventoryUpdate(user, {})).rejects.toThrow('INVENTORY_UPDATE_UNCONFIRMED'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('shows a conflict without echoing arbitrary upstream messages', async () => {
    fetcher.mockResolvedValue({ ok: false, json: async () => ({ code: 'INVENTORY_STOCK_CONFLICT', error: 'private backend data' }) });
    await expect(saveInventoryUpdate(user, {})).rejects.toThrow('INVENTORY_STOCK_CONFLICT');
  });
});
