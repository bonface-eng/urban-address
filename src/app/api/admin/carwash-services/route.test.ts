import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAuthorizeAdminRequest = vi.fn();
const mockGetSupabaseAdminClient = vi.fn();

vi.mock('@/lib/admin-auth', () => ({
  authorizeAdminRequest: (...args: any[]) => mockAuthorizeAdminRequest(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: () => mockGetSupabaseAdminClient(),
}));

import { GET, POST, PATCH } from './route';
import { PATCH as PATCH_BY_ID, DELETE as DELETE_BY_ID } from './[id]/route';

describe('admin carwash-services API authorization and CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks non-admin callers with 403 on all admin endpoints', async () => {
    mockAuthorizeAdminRequest.mockResolvedValue(null);

    const getRes = await GET(new NextRequest('http://localhost/api/admin/carwash-services'));
    const postRes = await POST(
      new NextRequest('http://localhost/api/admin/carwash-services', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', category: 'Wash', pricingType: 'fixed', price: 300 }),
      })
    );
    const patchRes = await PATCH(
      new NextRequest('http://localhost/api/admin/carwash-services', {
        method: 'PATCH',
        body: JSON.stringify({ reorder: [{ id: 'wash-normal', sortOrder: 1 }] }),
      })
    );
    const patchIdRes = await PATCH_BY_ID(
      new NextRequest('http://localhost/api/admin/carwash-services/wash-normal', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: 'wash-normal' }) }
    );
    const deleteIdRes = await DELETE_BY_ID(
      new NextRequest('http://localhost/api/admin/carwash-services/wash-normal', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'wash-normal' }) }
    );

    expect(getRes.status).toBe(403);
    expect(postRes.status).toBe(403);
    expect(patchRes.status).toBe(403);
    expect(patchIdRes.status).toBe(403);
    expect(deleteIdRes.status).toBe(403);
  });

  it('allows admin to create a service and rejects invalid prices', async () => {
    mockAuthorizeAdminRequest.mockResolvedValue({ uid: 'admin-1', email: 'admin@test.com', role: 'ADMIN' });

    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'wash-express',
        name: 'Express Wash',
        category: 'Wash',
        pricing_type: 'fixed',
        price: 250,
        currency: 'KES',
        is_active: true,
        sort_order: 5,
        commission: 30,
      },
      error: null,
    });
    mockGetSupabaseAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: singleMock,
          }),
        }),
      }),
    });

    const badRes = await POST(
      new NextRequest('http://localhost/api/admin/carwash-services', {
        method: 'POST',
        body: JSON.stringify({ name: 'Bad', category: 'Wash', pricingType: 'fixed', price: -5 }),
      })
    );
    expect(badRes.status).toBe(400);

    const okRes = await POST(
      new NextRequest('http://localhost/api/admin/carwash-services', {
        method: 'POST',
        body: JSON.stringify({ name: 'Express Wash', category: 'Wash', pricingType: 'fixed', price: 250 }),
      })
    );
    expect(okRes.status).toBe(201);
    const json = await okRes.json();
    expect(json.service.name).toBe('Express Wash');
    expect(json.service.price).toBe(250);
  });

  it('deactivates instead of hard-deleting when service appears in past sales', async () => {
    mockAuthorizeAdminRequest.mockResolvedValue({ uid: 'admin-1', email: 'admin@test.com', role: 'ADMIN' });

    const updateSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'wash-normal',
        name: 'Normal Wash',
        category: 'Wash',
        pricing_type: 'fixed',
        price: 300,
        currency: 'KES',
        is_active: false,
        sort_order: 10,
      },
      error: null,
    });

    mockGetSupabaseAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                contains: () => ({
                  limit: async () => ({ data: [{ id: 'ord-1' }], error: null }),
                }),
              }),
            }),
          };
        }
        return {
          update: () => ({
            eq: () => ({
              select: () => ({
                single: updateSingle,
              }),
            }),
          }),
        };
      },
    });

    const res = await DELETE_BY_ID(
      new NextRequest('http://localhost/api/admin/carwash-services/wash-normal', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'wash-normal' }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deactivated).toBe(true);
    expect(json.service.isActive).toBe(false);
  });
});
