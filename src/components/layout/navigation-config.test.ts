import { describe, expect, it } from 'vitest';
import { getVisibleNavGroups, NAV_GROUPS } from './navigation-config';

describe('shared navigation', () => {
  it('does not expose hub landing pages as navigation destinations', () => {
    const destinations = NAV_GROUPS.flatMap(group => group.items.map(item => item.href));
    expect(destinations.some(path => path.startsWith('/admin/hubs/'))).toBe(false);
  });

  it('exposes the direct destinations formerly linked from every hub to super admins', () => {
    const destinations = getVisibleNavGroups({ role: 'ADMIN', isSuperAdmin: true })
      .flatMap(group => group.items.map(item => item.href));
    [
      '/admin/intelligence', '/reports/fraud', '/admin/database',
      '/employees', '/attendants', '/admin/payroll',
      '/sales-history', '/finance', '/reports', '/customers',
      '/admin/loyalty', '/inventory', '/suppliers', '/carwash',
      '/admin', '/admin/branches', '/admin/digital-menu',
      '/admin/app-manager', '/admin/assets', '/admin/live-audio',
      '/admin/support', '/admin/documents', '/admin/help',
      '/dashboard', '/settings', '/kds', '/lounge', '/store', '/carwash/pos',
      '/carwash', '/admin/system-errors',
    ].forEach(path => expect(destinations).toContain(path));
  });

  it('respects role permissions, super-only modules and assigned stations', () => {
    const groups = getVisibleNavGroups({
      role: 'CASHIER',
      isSuperAdmin: false,
      assignedUnits: ['STORE'],
      permMap: {
        CASHIER: ['/store', '/admin/assets', '/lounge', '/dashboard'],
      },
    });
    const destinations = groups.flatMap(group => group.items.map(item => item.href));
    expect(destinations).toContain('/store');
    expect(destinations).not.toContain('/admin/assets');
    expect(destinations).not.toContain('/lounge');
    expect(destinations).toContain('/dashboard');
  });
});
