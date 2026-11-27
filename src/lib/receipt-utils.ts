/**
 * generateReceiptTxt
 * Master logic for generating character-aligned TXT receipts for 42-column POS80 printers.
 * Handles Sales, Reports, Vouchers, and Unpaid Quotes.
 */
export function generateReceiptTxt(data: any, settings?: any): string {
  const cols = 42;
  const separator = "-".repeat(cols);
  const doubleSeparator = "=".repeat(cols);
  
  const isReport = data.type === 'SYSTEM-REPORT' || data.reportType;
  const isVoucher = data.type === 'COMMISSION-VOUCHER';
  const isExpense = data.type === 'PETTY_CASH';
  const isCarwash = data.type === 'CARWASH';
  const isCarpet = data.jobType === 'CARPET';
  const isConsolidated = data.reportType === 'CONSOLIDATED-BILL';
  const isUnpaid = data.status === 'PENDING' || !data.status || data.status === 'DRAFT';
  const isLowStockReport = data.reportType === 'LOW-STOCK-REPORT';
  const isMovementReport = data.reportType === 'FAST-MOVING-REPORT' || data.reportType === 'SLOW-MOVING-REPORT';

  let brandHeader = settings?.storeHeader || 'URBAN ACCESSORIES';
  let paybill = settings?.paybill || '222111';
  let accountNo = settings?.accountNo || '035';
  
  if (data.type === 'LOUNGE') {
    brandHeader = settings?.loungeHeader || 'URBAN ADDRESS';
    paybill = settings?.loungePaybill || '516600';
    accountNo = settings?.loungeAccountNo || '449449';
  } else if (data.type === 'STORE' || data.type === 'CARWASH') {
    brandHeader = data.type === 'CARWASH' ? (settings?.carwashHeader || 'URBAN AUTO EXPRESS') : (settings?.storeHeader || 'URBAN ACCESSORIES');
    paybill = settings?.paybill || '222111';
    accountNo = settings?.accountNo || '035';
  }

  const branchName = settings?.branchName || 'NAKA CENTER BRANCH';
  const location = settings?.location || 'NAKURU, KENYA';
  const tel = settings?.phone || '0785860753';
  const dateObj = new Date(data.timestamp || Date.now());
  const orderId = data.displayId || data.id || `UAX-${Math.random().toString(36).substring(7).toUpperCase()}`;

  let content = "";
  
  // Status Header Tag
  content += `${isUnpaid ? "-NOT PAID RECEIPT-" : "-PAID RECEIPT-"}`.padStart((cols + 18) / 2) + "\n\n";

  content += `${brandHeader.padStart((cols + brandHeader.length) / 2)}\n`;
  content += `${branchName.padStart((cols + branchName.length) / 2)}\n`;
  content += `${location.padStart((cols + location.length) / 2)}\n`;
  content += `TEL: ${tel}`.padStart((cols + 5 + tel.length) / 2) + "\n";
  if (settings?.vatNumber) {
    content += `PIN: ${settings.vatNumber}`.padStart((cols + 5 + settings.vatNumber.length) / 2) + "\n";
  }
  content += `PAYBILL: ${paybill} ACC: ${accountNo}`.padStart((cols + 17 + paybill.length + accountNo.length) / 2) + "\n\n";
  
  content += doubleSeparator + "\n";
  
  let title = isUnpaid ? "BILL QUOTATION" : "SALES RECEIPT";
  if (data.reportType === 'X-REPORT') title = "X-REPORT (MID-SHIFT)";
  else if (data.reportType === 'Z-REPORT') title = "Z-REPORT (CLOSURE)";
  else if (isLowStockReport) title = "PROCUREMENT PICK-LIST";
  else if (data.reportType === 'CONSOLIDATED-PAYOUT') title = "TEAM PAYOUT LIST";
  else if (data.reportType === 'INVENTORY-REPORT') title = data.displayTitle || "INVENTORY AUDIT";
  else if (isMovementReport) title = data.displayTitle || "MOVEMENT AUDIT";
  else if (isConsolidated) title = "CONSOLIDATED RECEIPT";
  else if (isVoucher) title = "COMMISSION VOUCHER";
  else if (isExpense) title = "EXPENSE VOUCHER";
  else if (isCarwash) title = isCarpet ? "CARPET SERVICE" : (isUnpaid ? "SERVICE QUOTE" : "SERVICE RECEIPT");
  
  content += title.padStart((cols + title.length) / 2) + "\n";
  content += doubleSeparator + "\n\n";
  
  content += `REF ID: ${orderId}\n`;
  content += `DATE  : ${dateObj.toLocaleDateString('en-KE')}\n`;
  content += `TIME  : ${dateObj.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}\n`;
  
  if (data.cashierName) content += `CASHIER: ${data.cashierName.toUpperCase()}\n`;
  if (data.attendantName) content += `SERVED BY: ${data.attendantName.toUpperCase()}\n`;
  if (data.tableNumber) content += `TABLE: ${data.tableNumber}\n`;
  if (data.plateNumber) content += `${isCarpet ? 'REF' : 'VEHICLE'}: ${data.plateNumber}\n`;
  if (data.carpetDimensions) content += `SIZE  : ${data.carpetDimensions}\n`;
  
  content += "\n" + separator + "\n";
  
  if (isLowStockReport || data.reportType === 'INVENTORY-REPORT') {
    content += "DESCRIPTION".padEnd(25) + "QTY".padStart(17) + "\n";
  } else if (isMovementReport) {
    content += "DESCRIPTION".padEnd(25) + "SOLD".padStart(17) + "\n";
  } else if (data.reportType === 'CONSOLIDATED-PAYOUT') {
    content += "TEAM MEMBER".padEnd(25) + "TOTAL KES".padStart(17) + "\n";
  } else {
    content += "DESCRIPTION".padEnd(20) + "QTY".padEnd(6) + "TOTAL".padStart(16) + "\n";
  }
  
  content += separator + "\n";
  
  data.items?.forEach((item: any) => {
    if (isLowStockReport || data.reportType === 'INVENTORY-REPORT') {
      const name = item.name.substring(0, 24).padEnd(25);
      const stock = (item.quantity || 0).toString().padStart(17);
      content += `${name}${stock}\n`;
    } else if (isMovementReport) {
      const name = item.name.substring(0, 24).padEnd(25);
      const sold = (item.quantity || 0).toString().padStart(17);
      content += `${name}${sold}\n`;
    } else if (data.reportType === 'CONSOLIDATED-PAYOUT') {
      const name = item.name.substring(0, 24).padEnd(25);
      const total = item.price.toLocaleString().padStart(17);
      content += `${name}${total}\n`;
    } else {
      const name = item.name.substring(0, 19).padEnd(20);
      const qty = (item.quantity || 1).toString().padEnd(6);
      const price = (item.price * (item.quantity || 1)).toLocaleString().padStart(16);
      content += `${name}${qty}${price}\n`;
    }
  });
  
  content += separator + "\n";
  if (!isReport) {
    content += "GRAND TOTAL".padEnd(20) + " ".padEnd(6) + `KES ${data.total.toLocaleString()}`.padStart(16) + "\n";
  } else {
    content += "TOTAL VOLUME".padEnd(20) + " ".padEnd(6) + `KES ${data.total.toLocaleString()}`.padStart(16) + "\n";
  }
  content += separator + "\n\n";

  if (isUnpaid) {
      content += "STATUS: *** NOT PAID ***\n";
      content += "THIS IS NOT A FISCAL RECEIPT\n";
      content += `${settings?.unpaidFooterMessage || 'PLEASE SETTLE AT THE COUNTER'}\n\n`;
  } else {
      content += "STATUS: *** PAID ***\n";
      content += `${(settings?.footerNote || 'THANK YOU FOR YOUR PATRONAGE').toUpperCase()}\n\n`;
  }

  content += `${(settings?.footerTagline || 'Urban Express Business OS').toUpperCase()}\n`;

  return content;
}
