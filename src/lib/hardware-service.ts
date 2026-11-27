'use client';

import { Firestore } from 'firebase/firestore';
// @ts-expect-error esc-pos-encoder does not ship TypeScript declaration files
import EscPosEncoder from 'esc-pos-encoder';

/**
 * HardwareService
 * Handles terminal peripherals including thermal printing and cash drawer triggers.
 * Optimized for the new URBAN EXPRESS High-Fidelity Standard.
 */
export class HardwareService {
  private static isInitialized = false;
  private static serialPort: any = null;

  static getMode(): 'SERIAL' | 'PROXY' | 'NETWORK' {
    if (typeof window === 'undefined') return 'PROXY';
    const storedMode = localStorage.getItem('pos_print_mode');
    // Unknown legacy printer settings safely fall back to the existing local proxy mode.
    if (storedMode !== 'SERIAL' && storedMode !== 'PROXY' && storedMode !== 'NETWORK') return 'PROXY';
    return storedMode;
  }

  static setMode(mode: 'SERIAL' | 'PROXY' | 'NETWORK') {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos_print_mode', mode);
    }
  }

  static getPaperWidth(): '80mm' | '58mm' {
    if (typeof window === 'undefined') return '80mm';
    return (localStorage.getItem('pos_paper_width') as any) || '80mm';
  }

  static setPaperWidth(width: '80mm' | '58mm') {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos_paper_width', width);
    }
  }

  static setPrinterName(name: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos_printer_name', name);
    }
  }

  static getConfiguredPrinter(): string | null {
    if (typeof window === 'undefined') return 'POS-80';
    return localStorage.getItem('pos_printer_name') || 'POS-80';
  }

  static getProxyUrl(): string {
    if (typeof window === 'undefined') return 'http://127.0.0.1:9100';
    return localStorage.getItem('pos_proxy_url') || 'http://127.0.0.1:9100';
  }

  static setProxyUrl(url: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos_proxy_url', url);
    }
  }

  private static encodeReceipt(orderData: any, settings?: any): Uint8Array {
    const is80mm = this.getPaperWidth() === '80mm';
    const cols = is80mm ? 42 : 32;
    const encoder = new EscPosEncoder();
    
    // Type Resolution
    const isReport = orderData.type === 'SYSTEM-REPORT' || orderData.reportType;
    const isVoucher = orderData.type === 'COMMISSION-VOUCHER';
    const isExpense = orderData.type === 'PETTY_CASH';
    const isCarwash = orderData.type === 'CARWASH';
    const isCarpet = orderData.jobType === 'CARPET';
    const isUnpaid = orderData.status === 'PENDING' || !orderData.status;
    const isMovement = orderData.reportType === 'FAST-MOVING-REPORT' || orderData.reportType === 'SLOW-MOVING-REPORT';

    let brand = settings?.storeHeader || 'URBAN ACCESSORIES';
    let paybill = settings?.paybill || '222111';
    let account = settings?.accountNo || '035';

    if (orderData.type === 'LOUNGE') {
      brand = settings?.loungeHeader || 'URBAN ADDRESS';
      paybill = settings?.loungePaybill || '516600';
      account = settings?.loungeAccountNo || '449449';
    } else if (orderData.type === 'STORE' || orderData.type === 'CARWASH') {
      brand = orderData.type === 'CARWASH' ? (settings?.carwashHeader || 'URBAN AUTO EXPRESS') : (settings?.storeHeader || 'URBAN ACCESSORIES');
      paybill = settings?.paybill || '222111';
      account = settings?.accountNo || '035';
    }
    
    const dateObj = new Date(orderData.timestamp || Date.now());

    encoder.initialize()
           .align('center');

    // X/Z reports already contain their complete, reconciled ledger. Print that
    // exact text instead of rebuilding it as ordinary receipt line-items.
    if (typeof orderData.reportText === 'string' && orderData.reportText.trim()) {
      encoder.align('left');
      orderData.reportText.replace(/\r\n/g, '\n').split('\n').forEach((line: string) => {
        if (!line) {
          encoder.newline();
          return;
        }
        for (let offset = 0; offset < line.length; offset += cols) {
          encoder.line(line.slice(offset, offset + cols));
        }
      });
      encoder.newline().cut();
      return encoder.encode();
    }

    // Prominent Status Tag
    encoder.size('double')
           .line(isUnpaid ? "-NOT PAID RECEIPT-" : "-PAID RECEIPT-")
           .size('normal')
           .newline();

    encoder.size('double')
           .line(brand)
           .size('normal')
           .line(settings?.branchName || "NAKA CENTER BRANCH")
           .line(settings?.location || "NAKURU, KENYA")
           .line(`TEL: ${settings?.phone || "0785860753"}`);
    
    if (settings?.vatNumber) {
      encoder.line(`PIN: ${settings.vatNumber}`);
    }

    encoder.line(`PAYBILL: ${paybill} ACC: ${account}`)
           .newline()
           .line("=".repeat(cols));

    // Dynamic Header
    let title = isUnpaid ? "BILL QUOTATION" : "SALES RECEIPT";
    if (orderData.reportType === 'X-REPORT') title = "X-REPORT (MID-SHIFT)";
    else if (orderData.reportType === 'Z-REPORT') title = "Z-REPORT (CLOSURE)";
    else if (orderData.reportType === 'LOW-STOCK-REPORT') title = "PROCUREMENT PICK-LIST";
    else if (orderData.reportType === 'CONSOLIDATED-PAYOUT') title = "TEAM PAYOUT LIST";
    else if (orderData.reportType === 'INVENTORY-REPORT') title = orderData.displayTitle || "INVENTORY AUDIT";
    else if (isMovement) title = orderData.displayTitle || "MOVEMENT AUDIT";
    else if (isVoucher) title = "COMMISSION VOUCHER";
    else if (isExpense) title = "EXPENSE VOUCHER";
    else if (isCarwash) title = isCarpet ? "CARPET SERVICE" : (isUnpaid ? "SERVICE QUOTE" : "SERVICE RECEIPT");

    encoder.line(title)
           .line("=".repeat(cols))
           .align('left')
           .line(`REF ID: ${orderData.displayId || orderData.id || 'UAX-DRAFT'}`.padEnd(cols))
           .line(`DATE: ${dateObj.toLocaleDateString('en-KE')}`.padEnd(cols))
           .line(`TIME: ${dateObj.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`.padEnd(cols));

    if (orderData.tableNumber) {
      encoder.line(`TABLE: ${orderData.tableNumber}`.padEnd(cols));
    }
    if (orderData.plateNumber) {
      encoder.line(`${isCarpet ? 'REF' : 'VEHICLE'}: ${orderData.plateNumber}`.padEnd(cols));
    }
    if (orderData.cashierName) {
      encoder.line(`CASHIER: ${orderData.cashierName.toUpperCase()}`.padEnd(cols));
    }
    if (orderData.attendantName) {
      encoder.line(`SERVED BY: ${orderData.attendantName.toUpperCase()}`.padEnd(cols));
    }

    encoder.line("-".repeat(cols));
    
    // Header Row for Table
    if (orderData.reportType === 'LOW-STOCK-REPORT' || orderData.reportType === 'INVENTORY-REPORT') {
      encoder.line("DESCRIPTION".padEnd(25) + "STOCK".padStart(17));
    } else if (isMovement) {
      encoder.line("DESCRIPTION".padEnd(25) + "SOLD".padStart(17));
    } else if (orderData.reportType === 'CONSOLIDATED-PAYOUT') {
      encoder.line("TEAM MEMBER".padEnd(25) + "TOTAL KES".padStart(17));
    } else {
      encoder.line("DESCRIPTION".padEnd(20) + "QTY".padEnd(6) + "TOTAL".padStart(16));
    }
    
    encoder.line("-".repeat(cols));

    if (orderData.items) {
      orderData.items.forEach((item: any) => {
        if (orderData.reportType === 'LOW-STOCK-REPORT' || orderData.reportType === 'INVENTORY-REPORT') {
          const name = item.name.substring(0, 24).padEnd(25);
          const stock = (item.quantity || 0).toString().padStart(17);
          encoder.line(`${name}${stock}`);
        } else if (isMovement) {
          const name = item.name.substring(0, 24).padEnd(25);
          const sold = (item.quantity || 0).toString().padStart(17);
          encoder.line(`${name}${sold}`);
        } else if (orderData.reportType === 'CONSOLIDATED-PAYOUT') {
          const name = item.name.substring(0, 24).padEnd(25);
          const total = item.price.toLocaleString().padStart(17);
          encoder.line(`${name}${total}`);
        } else {
          const name = item.name.substring(0, 19).padEnd(20);
          const qty = (item.quantity || 1).toString().padEnd(6);
          const price = (item.price * (item.quantity || 1)).toLocaleString().padStart(16);
          encoder.line(`${name}${qty}${price}`);
        }
      });
    }

    encoder.line("-".repeat(cols));

    if (!isReport) {
      encoder.line(`SUBTOTAL`.padEnd(20) + `KES ${orderData.total.toLocaleString()}`.padStart(22))
             .size('double')
             .line(`GRAND TOTAL`.padEnd(10) + `KES ${orderData.total.toLocaleString()}`.padStart(11))
             .size('normal')
             .line("-".repeat(cols));
      
      if (!isUnpaid) {
        encoder.line(`PAYMENT: ${orderData.paymentMethod || 'CASH'}`.padEnd(cols))
               .line(`STATUS: *** PAID ***`.padEnd(cols));
      } else {
        encoder.line("STATUS: *** NOT PAID ***".padEnd(cols))
               .line("SETTLEMENT REQUIRED AT COUNTER".padEnd(cols));
      }
    } else {
      encoder.size('double')
             .line(`TOTAL VOL`.padEnd(10) + `KES ${orderData.total.toLocaleString()}`.padStart(11))
             .size('normal');
    }

    encoder.line("-".repeat(cols))
           .newline()
           .align('center');

    if (isUnpaid) {
      encoder.line("THIS IS NOT A FISCAL RECEIPT")
             .line("PLEASE SETTLE AT THE COUNTER")
             .newline();
    }

    encoder.line("=".repeat(cols))
           .newline()
           .cut();

    return encoder.encode();
  }

  static async printReceipt(orderData: any, settings?: any): Promise<{ success: boolean; error?: string }> {
    if (typeof window === 'undefined') return { success: false, error: 'NO_WINDOW' };
    const mode = this.getMode();
    const bytes = this.encodeReceipt(orderData, settings);

    if (mode === 'SERIAL' && this.serialPort) {
      try {
        const writer = this.serialPort.writable.getWriter();
        await writer.write(bytes);
        writer.releaseLock();
        return { success: true };
      } catch (err: any) { return { success: false, error: err.message }; }
    }

    if (mode === 'PROXY') {
      try {
        const base64Data = btoa(String.fromCharCode(...bytes));
        const response = await fetch(this.getProxyUrl() + '/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            printer: this.getConfiguredPrinter() || 'POS-80',
            data: base64Data,
            format: 'base64'
          })
        });
        return { success: response.ok };
      } catch (err: any) { return { success: false, error: err.message }; }
    }

    return { success: false, error: 'MODE_NOT_READY' };
  }

  static async triggerCashDrawer(db: Firestore, userId: string, reason: string = 'Sale'): Promise<boolean> {
    const mode = this.getMode();
    if (mode === 'PROXY') {
      const kickBytes = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
      try {
        const base64Data = btoa(String.fromCharCode(...kickBytes));
        await fetch(this.getProxyUrl() + '/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printer: this.getConfiguredPrinter(), data: base64Data, format: 'base64' })
        });
        return true;
      } catch (e) { return false; }
    }
    return false;
  }

  static async requestSerialPort() {
    if (typeof window === 'undefined' || !('serial' in navigator)) return false;
    try {
      this.serialPort = await (navigator as any).serial.requestPort();
      await this.serialPort.open({ baudRate: 9600 });
      return true;
    } catch (e) { return false; }
  }
}
