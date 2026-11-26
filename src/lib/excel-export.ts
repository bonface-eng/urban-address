import ExcelJS from 'exceljs';
import { Product, BusinessUnit } from '@/lib/types';

interface ExportAuditOptions {
  inventory: Product[];
  unit: BusinessUnit;
  searchTerm?: string;
}

export async function exportInventoryAuditExcel({ inventory, unit }: ExportAuditOptions) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Urban Business OS';
  workbook.lastModifiedBy = 'Urban Admin Audit';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`${unit} Audit Sheet`, {
    views: [{ showGridLines: true }]
  });

  // Set Column Definitions & Widths
  worksheet.columns = [
    { key: 'sn', width: 8 },
    { key: 'name', width: 35 },
    { key: 'category', width: 20 },
    { key: 'barcode', width: 22 },
    { key: 'systemStock', width: 16 },
    { key: 'physicalCount', width: 18 },
    { key: 'discrepancy', width: 16 },
    { key: 'comments', width: 30 }
  ];

  // --- BRAND HEADER BLOCK ---
  worksheet.mergeCells('A1:H1');
  const companyCell = worksheet.getCell('A1');
  companyCell.value = 'URBAN EXPRESS';
  companyCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFF6600' } }; // Brand primary orange
  companyCell.alignment = { horizontal: 'left', vertical: 'middle' };

  worksheet.mergeCells('A2:H2');
  const titleCell = worksheet.getCell('A2');
  titleCell.value = `OFFICIAL INVENTORY AUDIT FORM — ${unit} DEPARTMENT`;
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF18181B' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

  worksheet.mergeCells('A3:H3');
  const metaCell = worksheet.getCell('A3');
  const dateStr = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
  const refCode = `UAX-AUD-${Date.now().toString().slice(-6)}`;
  metaCell.value = `Audit Reference: ${refCode}  |  Generated: ${dateStr}  |  Location: Nakuru HQ`;
  metaCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF71717A' } };
  metaCell.alignment = { horizontal: 'left', vertical: 'middle' };

  worksheet.addRow([]); // Row 4 Blank

  // --- TABLE HEADERS ---
  const headers = [
    'S/N',
    'PRODUCT NAME',
    'CATEGORY',
    'BARCODE / SKU',
    'SYSTEM STOCK',
    'PHYSICAL COUNT',
    'DISCREPANCY',
    'COMMENTS / NOTES'
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF18181B' } // Dark Zinc
    };
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF18181B' } },
      left: { style: 'thin', color: { argb: 'FF3F3F46' } },
      bottom: { style: 'medium', color: { argb: 'FF18181B' } },
      right: { style: 'thin', color: { argb: 'FF3F3F46' } }
    };
  });

  // Align product name & category header text to left
  worksheet.getCell('B5').alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getCell('C5').alignment = { horizontal: 'left', vertical: 'middle' };

  // --- DATA ROWS ---
  inventory.forEach((item, index) => {
    const row = worksheet.addRow([
      index + 1,
      item.name.toUpperCase(),
      item.category.toUpperCase(),
      item.barcode || 'N/A',
      item.stockLevel,
      '', // Physical count (blank for entry)
      '', // Discrepancy (blank for calculation)
      ''  // Comments
    ]);

    row.height = 24;

    const rowNumber = row.number;
    const isEven = index % 2 === 0;
    const bgArgb = isEven ? 'FFFFFFFF' : 'FFF9FAFB'; // Subtle zebra striping

    row.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb }
      };
      cell.font = { name: 'Arial', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };

      // Alignment rules per column
      if (colNumber === 1) { // S/N
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Arial', size: 9, color: { argb: 'FF9CA3AF' } };
      } else if (colNumber === 2) { // Name
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111827' } };
      } else if (colNumber === 3) { // Category
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Arial', size: 9, color: { argb: 'FF4B5563' } };
      } else if (colNumber === 4) { // Barcode
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Courier New', size: 9, color: { argb: 'FF6B7280' } };
      } else if (colNumber === 5) { // System Stock
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF111827' } };
      } else if (colNumber === 6) { // Physical Count Box (Highlighted box)
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FFFF6600' } },
          left: { style: 'medium', color: { argb: 'FFFF6600' } },
          bottom: { style: 'medium', color: { argb: 'FFFF6600' } },
          right: { style: 'medium', color: { argb: 'FFFF6600' } }
        };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  // --- SUMMARY / SIGNATURE BLOCK ---
  worksheet.addRow([]);
  worksheet.addRow([]);

  const sigStartRow = worksheet.lastRow ? worksheet.lastRow.number + 1 : 20;

  worksheet.mergeCells(`A${sigStartRow}:D${sigStartRow}`);
  const sig1 = worksheet.getCell(`A${sigStartRow}`);
  sig1.value = 'STAFF AUDITOR SIGNATURE: ___________________________';
  sig1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF374151' } };

  worksheet.mergeCells(`E${sigStartRow}:H${sigStartRow}`);
  const sig2 = worksheet.getCell(`E${sigStartRow}`);
  sig2.value = 'SUPERVISOR APPROVAL: ___________________________';
  sig2.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF374151' } };

  const footerRow = sigStartRow + 2;
  worksheet.mergeCells(`A${footerRow}:H${footerRow}`);
  const footerCell = worksheet.getCell(`A${footerRow}`);
  footerCell.value = 'Official Urban Express Business Document • High-Density Inventory Protocol';
  footerCell.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF9CA3AF' } };
  footerCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Write to Buffer & Trigger Browser Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = `Urban_Express_Audit_${unit}_${new Date().toISOString().split('T')[0]}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
