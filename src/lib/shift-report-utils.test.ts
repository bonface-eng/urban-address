import { describe, expect, it } from 'vitest';
import { generateShiftReportTxt } from './shift-report-utils';
import type { Order } from './types';

const cashierOrders: Order[] = [
  {
    id: 'cash-sale-1',
    type: 'STORE',
    status: 'PAID',
    total: 800,
    paymentMethod: 'CASH',
    cashierId: 'cashier-1',
    cashTendered: 1000,
    changeDue: 200,
    timestamp: 1_800_000_000_000,
    paidAt: 1_800_000_000_100,
    items: [],
  },
  {
    id: 'mobile-sale-1',
    type: 'LOUNGE',
    status: 'PAID',
    total: 500,
    paymentMethod: 'MOBILE',
    cashierId: 'cashier-1',
    timestamp: 1_800_000_001_000,
    items: [],
  },
  {
    id: 'airtel-sale-1',
    type: 'STORE',
    status: 'PAID',
    total: 300,
    paymentMethod: 'MOBILE',
    paymentProvider: 'AIRTEL_MONEY',
    cashierId: 'cashier-1',
    timestamp: 1_800_000_001_500,
    items: [],
  },
  {
    id: 'other-cashier-sale',
    type: 'CARWASH',
    status: 'PAID',
    total: 9_999,
    paymentMethod: 'CASH',
    cashierId: 'cashier-2',
    timestamp: 1_800_000_002_000,
    items: [],
  },
];

describe('individual X/Z shift cash reconciliation', () => {
  it.each(['X', 'Z'] as const)('prints the correct cashier cash position on %s reports', type => {
    const report = generateShiftReportTxt({
      type,
      cashierName: 'Cashier One',
      cashierId: 'cashier-1',
      periodLabel: 'TODAY',
      orders: cashierOrders,
    });

    expect(report).toContain('CASH TRANSACTIONS');
    expect(report).toContain('CASH SALES TOTAL');
    expect(report).toContain('KES 800');
    expect(report).toContain('CASH TENDERED');
    expect(report).toContain('KES 1,000');
    expect(report).toContain('CHANGE RETURNED');
    expect(report).toContain('KES 200');
    expect(report).toContain('EXPECTED CASH FROM SALES');
    expect(report).toContain('EXPECTED M-PESA VOLUME');
    expect(report).toContain('KES 500');
    expect(report).toContain('EXPECTED AIRTEL VOLUME');
    expect(report).toContain('KES 300');
    expect(report).not.toContain('9,999');
  });


  it('reconciles legacy cashReceived/change fields from older POS receipts', () => {
    const legacyCashOrder: Order = {
      id: 'legacy-cash-sale',
      type: 'LOUNGE',
      status: 'PAID',
      total: 400,
      paymentMethod: 'CASH',
      cashierId: 'cashier-1',
      cashReceived: 500,
      change: 100,
      timestamp: 1_800_000_003_000,
      items: [],
    } as Order;

    const report = generateShiftReportTxt({
      type: 'Z',
      cashierName: 'Cashier One',
      cashierId: 'cashier-1',
      periodLabel: 'TODAY',
      orders: [legacyCashOrder],
    });

    expect(report).toContain('CASH SALES TOTAL');
    expect(report).toContain('KES 400');
    expect(report).toContain('CASH TENDERED');
    expect(report).toContain('KES 500');
    expect(report).toContain('CHANGE RETURNED');
    expect(report).toContain('KES 100');
    expect(report).toContain('EXPECTED CASH FROM SALES');
  });

  it('only asks for a physical cash count on the final Z report', () => {
    const params = {
      cashierName: 'Cashier One',
      cashierId: 'cashier-1',
      periodLabel: 'TODAY',
      orders: cashierOrders,
    };
    expect(generateShiftReportTxt({ ...params, type: 'X' })).not.toContain('PHYSICAL CASH COUNTED');
    expect(generateShiftReportTxt({ ...params, type: 'Z' })).toContain('PHYSICAL CASH COUNTED');
  });
});
