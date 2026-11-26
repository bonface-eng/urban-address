import { jsPDF } from 'jspdf';
import { Product, BusinessUnit } from '@/lib/types';

interface ExportPDFOptions {
  inventory: Product[];
  unit: BusinessUnit;
}

export function exportInventoryAuditPDF({ inventory, unit }: ExportPDFOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  const dateStr = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
  const refCode = `UAX-AUD-${Date.now().toString().slice(-6)}`;

  // Helper to check page bounds & insert new page if needed
  const checkNewPage = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 20) {
      doc.addPage();
      y = margin;
      drawHeader();
      drawTableHeader();
    }
  };

  const drawHeader = () => {
    // Brand title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(255, 102, 0); // #FF6600 Urban Orange
    doc.text('URBAN EXPRESS', margin, y + 4);

    doc.setFontSize(11);
    doc.setTextColor(24, 24, 27); // Dark zinc
    doc.text(`INVENTORY AUDIT SHEET — ${unit} DEPARTMENT`, margin, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122); // Zinc muted
    doc.text(`Date: ${dateStr}  |  Ref: ${refCode}  |  Location: Nakuru HQ`, margin, y + 15);

    y += 18;

    // Header Divider Line
    doc.setDrawColor(24, 24, 27);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);

    y += 5;
  };

  const drawTableHeader = () => {
    const colWidths = [12, 60, 30, 25, 25, 30]; // Sum = 182mm (Page width 210mm - 28mm margins = 182mm)
    const headers = ['S/N', 'Product Name', 'Category', 'System', 'Actual', 'Comments'];

    // Header background bar
    doc.setFillColor(24, 24, 27); // Dark Zinc
    doc.rect(margin, y, pageWidth - (margin * 2), 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    let currentX = margin;
    headers.forEach((h, i) => {
      const width = colWidths[i];
      let alignX = currentX + 2;
      if (i === 0) alignX = currentX + width / 2; // Center S/N
      if (i === 3 || i === 4) alignX = currentX + width / 2; // Center counts

      if (i === 0 || i === 3 || i === 4) {
        doc.text(h, alignX, y + 4.8, { align: 'center' });
      } else {
        doc.text(h, alignX, y + 4.8);
      }
      currentX += width;
    });

    y += 7;
  };

  // Initial header & table header draw
  drawHeader();
  drawTableHeader();

  // Table Data Rows
  const colWidths = [12, 60, 30, 25, 25, 30];

  inventory.forEach((item, index) => {
    checkNewPage(8);

    const isEven = index % 2 === 0;
    if (!isEven) {
      doc.setFillColor(248, 250, 252); // Very light slate
      doc.rect(margin, y, pageWidth - (margin * 2), 7.5, 'F');
    }

    doc.setDrawColor(229, 231, 235); // Light zinc border
    doc.setLineWidth(0.2);
    doc.rect(margin, y, pageWidth - (margin * 2), 7.5, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    let currentX = margin;

    // S/N
    doc.text(String(index + 1), currentX + colWidths[0] / 2, y + 5, { align: 'center' });
    currentX += colWidths[0];

    // Name (Truncate if necessary)
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const truncatedName = item.name.length > 32 ? item.name.substring(0, 30) + '...' : item.name;
    doc.text(truncatedName.toUpperCase(), currentX + 2, y + 5);
    currentX += colWidths[1];

    // Category
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const truncatedCategory = item.category.length > 18 ? item.category.substring(0, 16) + '...' : item.category;
    doc.text(truncatedCategory.toUpperCase(), currentX + 2, y + 5);
    currentX += colWidths[2];

    // System Stock
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(item.stockLevel), currentX + colWidths[3] / 2, y + 5, { align: 'center' });
    currentX += colWidths[3];

    // Actual Count (Drawn box for pencil count)
    doc.setDrawColor(255, 102, 0); // Orange box outline
    doc.setLineWidth(0.3);
    doc.rect(currentX + 3, y + 1.2, colWidths[4] - 6, 5.1, 'S');
    currentX += colWidths[4];

    // Comments line
    doc.setDrawColor(203, 213, 225);
    doc.line(currentX + 2, y + 5.5, currentX + colWidths[5] - 2, y + 5.5);

    y += 7.5;
  });

  // Footer & Signature Block
  checkNewPage(35);
  y += 10;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);

  // Signature 1
  doc.line(margin + 5, y + 12, margin + 75, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('STAFF MEMBER SIGNATURE', margin + 5, y + 16);

  // Signature 2
  doc.line(pageWidth - margin - 75, y + 12, pageWidth - margin - 5, y + 12);
  doc.text('SUPERVISOR APPROVAL', pageWidth - margin - 75, y + 16);

  // Document Footer
  y += 24;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Official Urban Express Document • High-Density Inventory Audit Protocol', pageWidth / 2, y, { align: 'center' });

  // Save PDF file
  const filename = `Urban_Express_Audit_${unit}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
