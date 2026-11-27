import { Order } from './types';

export interface ShiftReportParams {
  type: 'X' | 'Z';
  cashierName: string;
  cashierId: string;
  periodLabel: string;
  orders: Order[];
  heldBills?: Order[];
  stats?: {
    loungeSales?: number;
    storeSales?: number;
    carwashSales?: number;
    totalSales?: number;
  };
  settings?: {
    branchName?: string;
    location?: string;
    phone?: string;
    vatNumber?: string;
  };
}

/**
 * generateShiftReportTxt
 * Standardized 42-column POS character-aligned shift audit report.
 * Supports X-Report (interim mid-shift) and Z-Report (end-of-shift closing).
 * Features itemized ledger referencing every single receipt number.
 */
export function generateShiftReportTxt(params: ShiftReportParams): string {
  const {
    type,
    cashierName,
    cashierId,
    periodLabel,
    orders,
    heldBills = [],
    settings
  } = params;

  const cols = 42;
  const sep = "-".repeat(cols);
  const dSep = "=".repeat(cols);

  const center = (text: string) => {
    const space = Math.max(0, Math.floor((cols - text.length) / 2));
    return " ".repeat(space) + text;
  };

  const branchName = settings?.branchName || 'NAKA CENTER BRANCH';
  const location = settings?.location || 'NAKURU, KENYA';
  const tel = settings?.phone || '0785860753';
  const reportDate = new Date();

  // Aggregate metrics from orders
  const paidOrders = orders.filter(o => o.status === 'PAID');
  const loungeOrders = paidOrders.filter(o => o.type === 'LOUNGE');
  const storeOrders = paidOrders.filter(o => o.type === 'STORE');
  const carwashOrders = paidOrders.filter(o => o.type === 'CARWASH');

  const loungeTotal = loungeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const storeTotal = storeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const carwashTotal = carwashOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalSales = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // Payment method breakdowns
  const paymentBreakdown: Record<string, { total: number; count: number }> = {};
  paidOrders.forEach(o => {
    const method = (o.paymentMethod || 'CASH').toUpperCase();
    if (!paymentBreakdown[method]) {
      paymentBreakdown[method] = { total: 0, count: 0 };
    }
    paymentBreakdown[method].total += (o.total || 0);
    paymentBreakdown[method].count += 1;
  });

  // Held / pending bills totals
  const heldTotal = heldBills.reduce((sum, b) => sum + (b.total || 0), 0);

  let out = "";

  // 1. Header
  out += dSep + "\n";
  out += center("URBAN EXPRESS POS") + "\n";
  out += center(branchName) + "\n";
  out += center(location) + "\n";
  out += center(`TEL: ${tel}`) + "\n";
  if (settings?.vatNumber) {
    out += center(`PIN: ${settings.vatNumber}`) + "\n";
  }
  out += dSep + "\n";

  // 2. Report Classification
  const title = type === 'X' 
    ? "SHIFT X-REPORT (MID-SHIFT AUDIT)" 
    : "SHIFT Z-REPORT (FINAL SHIFT CLOSURE)";
  out += center(title) + "\n";
  out += dSep + "\n\n";

  out += `DATE/TIME: ${reportDate.toLocaleDateString('en-KE')} ${reportDate.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}\n`;
  out += `CASHIER  : ${cashierName.toUpperCase()}\n`;
  out += `STAFF ID : ${cashierId}\n`;
  out += `PERIOD   : ${periodLabel}\n`;
  out += `STATUS   : ${type === 'X' ? 'INTERIM (SHIFT OPEN)' : 'OFFICIAL FINAL CLOSING'}\n`;
  out += sep + "\n\n";

  // 3. Sales Performance Summary
  out += center("SALES YIELD SUMMARY") + "\n";
  out += sep + "\n";
  out += "PAID TRANSACTIONS : ".padEnd(25) + paidOrders.length.toString().padStart(17) + "\n";
  out += "TOTAL SALES VOLUME: ".padEnd(25) + `KES ${totalSales.toLocaleString()}`.padStart(17) + "\n";
  out += sep + "\n\n";

  // 4. Departmental Split
  out += center("DEPARTMENTAL REVENUE") + "\n";
  out += sep + "\n";
  out += `Lounge & Bar (${loungeOrders.length})`.padEnd(25) + `KES ${loungeTotal.toLocaleString()}`.padStart(17) + "\n";
  out += `Retail Store (${storeOrders.length})`.padEnd(25) + `KES ${storeTotal.toLocaleString()}`.padStart(17) + "\n";
  out += `Carwash (${carwashOrders.length})`.padEnd(25) + `KES ${carwashTotal.toLocaleString()}`.padStart(17) + "\n";
  out += sep + "\n\n";

  // 5. Payment Methods
  out += center("PAYMENT METHODS BREAKDOWN") + "\n";
  out += sep + "\n";
  const paymentEntries = Object.entries(paymentBreakdown);
  if (paymentEntries.length === 0) {
    out += center("NO TRANSACTIONS RECORDED") + "\n";
  } else {
    paymentEntries.forEach(([method, data]) => {
      const label = `${method} (${data.count})`;
      out += label.padEnd(25) + `KES ${data.total.toLocaleString()}`.padStart(17) + "\n";
    });
  }
  out += sep + "\n\n";

  // 6. Active Pending & Held Bills
  out += center("ACTIVE PENDING / HELD BILLS") + "\n";
  out += sep + "\n";
  out += "HELD BILLS COUNT  : ".padEnd(25) + heldBills.length.toString().padStart(17) + "\n";
  out += "UNSETTLED VOLUME  : ".padEnd(25) + `KES ${heldTotal.toLocaleString()}`.padStart(17) + "\n";
  if (heldBills.length > 0) {
    out += "\nHELD BILL DETAILS:\n";
    heldBills.forEach((hb, idx) => {
      const ref = hb.id?.slice(0, 8).toUpperCase() || `HELD-${idx + 1}`;
      const target = hb.tableNumber ? `Table ${hb.tableNumber}` : (hb.plateNumber || hb.type);
      out += ` [${(idx + 1).toString().padStart(2, '0')}] #${ref} (${target})`.padEnd(25) + `KES ${(hb.total || 0).toLocaleString()}`.padStart(17) + "\n";
    });
  } else {
    out += center("ALL ORDERS SETTLED (0 PENDING)") + "\n";
  }
  out += sep + "\n\n";

  // 7. Itemized Sales Ledger Referencing Each Receipt Number
  out += dSep + "\n";
  out += center("ITEMIZED SALES LEDGER") + "\n";
  out += center("(EACH RECEIPT REFERENCED)") + "\n";
  out += dSep + "\n";

  if (paidOrders.length === 0) {
    out += center("NO SALES COMPLETED IN THIS SHIFT") + "\n";
  } else {
    paidOrders.forEach((o, index) => {
      const receiptNo = o.id || `RCP-${index + 1}`;
      const timeStr = new Date(o.timestamp).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
      const orderType = o.type || 'SALE';
      const target = o.tableNumber ? `TBL ${o.tableNumber}` : (o.plateNumber ? o.plateNumber : (o.customerName || ''));
      const payMethod = (o.paymentMethod || 'CASH').toUpperCase();

      out += `[${(index + 1).toString().padStart(3, '0')}] RECEIPT #: ${receiptNo}\n`;
      out += `      TIME    : ${timeStr} | ${orderType}${target ? ` (${target})` : ''}\n`;
      out += `      PAYMENT : ${payMethod}\n`;
      out += `      AMOUNT  : KES ${(o.total || 0).toLocaleString()}\n`;

      if (o.items && o.items.length > 0) {
        out += `      ITEMS   : ${o.items.length} item(s)\n`;
        o.items.forEach(it => {
          const itemLine = `        • ${(it.quantity || 1)}x ${it.name}`;
          const itemVal = `KES ${((it.price || 0) * (it.quantity || 1)).toLocaleString()}`;
          out += itemLine.padEnd(28).substring(0, 28) + itemVal.padStart(14) + "\n";
        });
      }
      out += sep + "\n";
    });
  }

  out += "\n";

  // 8. Closing or Interim Declaration
  if (type === 'Z') {
    const cashTotal = paymentBreakdown['CASH']?.total || 0;
    const mpesaTotal = paymentBreakdown['MPESA']?.total || 0;

    out += dSep + "\n";
    out += center("END-OF-SHIFT CASHIER RECONCILIATION") + "\n";
    out += dSep + "\n";
    out += `EXPECTED CASH IN DRAWER: KES ${cashTotal.toLocaleString()}\n`;
    out += `EXPECTED M-PESA VOLUME : KES ${mpesaTotal.toLocaleString()}\n`;
    out += "PHYSICAL CASH COUNTED  : KES __________________\n";
    out += "CASH VARIANCE (+ / -)  : KES __________________\n\n";

    if (heldBills.length > 0) {
      out += `WARNING: ${heldBills.length} UNSETTLED HELD BILL(S) REMAIN!\n`;
      out += "ENSURE ALL TICKETS ARE PROCESSED OR HANDED OVER.\n\n";
    }

    out += "CASHIER DECLARATION:\n";
    out += "I certify that this closure report represents\n";
    out += "a full and accurate accounting of my shift.\n\n";
    out += `CASHIER NAME : ${cashierName.toUpperCase()}\n`;
    out += "CASHIER SIGN : ___________________________\n\n";
    out += "SUPERVISOR AUDIT:\n";
    out += "VERIFIED BY  : ___________________________\n";
    out += "SIGNATURE    : ___________________________\n";
    out += `CLOSED AT    : ${reportDate.toLocaleTimeString('en-KE')}\n`;
    out += dSep + "\n";
  } else {
    out += dSep + "\n";
    out += center("MID-SHIFT INTERIM STATUS") + "\n";
    out += center("* SHIFT REMAINS OPEN & ACTIVE *") + "\n";
    out += center("DO NOT DISCARD - RETAIN FOR SHIFT END") + "\n";
    out += dSep + "\n";
  }

  out += "\n" + center("DRIVEN BY PRECISION") + "\n";
  out += center("URBAN EXPRESS BUSINESS OS") + "\n";
  out += dSep + "\n";

  return out;
}

/**
 * downloadTxtFile
 * Triggers a browser download of a text report.
 * Explicitly defaults to download.txt per user specification.
 */
export function downloadTxtFile(content: string, filename: string = 'download.txt') {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    if (link.parentNode) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 150);
}

/**
 * printReportDirect
 * Renders thermal formatted receipt text to a hidden print iframe.
 */
export function printReportDirect(content: string) {
  if (typeof window === 'undefined') return;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Shift Report</title>
        <style>
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            font-weight: bold;
            line-height: 1.25;
            margin: 4mm;
            padding: 0;
            color: #000;
            white-space: pre-wrap;
            word-break: break-all;
          }
        </style>
      </head>
      <body>${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
    </html>
  `);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 250);
}
