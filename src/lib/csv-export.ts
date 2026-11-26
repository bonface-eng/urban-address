/**
 * exportAsReceiptText
 * Standardizes all system exports into character-aligned TXT files 
 * that match the physical thermal receipt format (42-column POS80).
 */
export function exportAsReceiptText(data: any[], fileName: string, headers?: Record<string, string>) {
  const cols = 42;
  const sep = "-".repeat(cols);
  const dSep = "=".repeat(cols);
  
  // Center padding helper
  const center = (text: string) => {
    const space = Math.max(0, Math.floor((cols - text.length) / 2));
    return " ".repeat(space) + text;
  };

  let content = "";
  content += center("URBAN EXPRESS") + "\n";
  content += center("NAKA CENTER, NAKURU") + "\n";
  content += center("TEL: 0785860753") + "\n";
  content += dSep + "\n";
  content += center(fileName.toUpperCase().replace(/_/g, ' ')) + "\n";
  content += dSep + "\n";
  content += `PRINT DATE: ${new Date().toLocaleString('en-KE')}\n`;
  content += `RECORDS   : ${data.length}\n`;
  content += sep + "\n\n";

  // Resolve headers
  const keys = headers ? Object.keys(headers) : (data.length > 0 ? Object.keys(data[0]) : []);
  const headerMap = headers || (keys.reduce((acc, k) => ({ ...acc, [k]: k }), {}));

  data.forEach((item, index) => {
    if (keys.length <= 3 && keys.length > 0) {
        // High-density table row (2-3 columns max for horizontal alignment)
        let row = "";
        keys.forEach((key, kIdx) => {
            const val = String(item[key] || '');
            if (kIdx === 0) row += val.padEnd(20).substring(0, 20);
            else if (kIdx === 1) row += val.padEnd(10).substring(0, 10);
            else row += val.padStart(12).substring(0, 12);
        });
        content += row + "\n";
    } else {
        // Detailed data block (Standard for registries and logs)
        content += `[${(index + 1).toString().padStart(3, '0')}] `;
        
        // Use the first key as the block header
        const primaryKey = keys[0];
        const primaryVal = String(item[primaryKey] || 'N/A').toUpperCase();
        content += primaryVal + "\n";

        // List remaining fields
        keys.slice(1).forEach((key) => {
            const label = headerMap[key] || key;
            let value = item[key];
            
            // Format timestamps
            if (typeof value === 'number' && (key.toLowerCase().includes('time') || key.toLowerCase().includes('createdat') || key.toLowerCase().includes('timestamp'))) {
                value = new Date(value).toLocaleString('en-KE');
            }
            
            const valStr = String(value || '---');
            content += `  ${label.padEnd(12)}: ${valStr}\n`;
        });
        content += sep + "\n";
    }
  });

  content += "\n" + center("DRIVEN BY PRECISION") + "\n";
  content += center("UAX OS NODE EXPORT") + "\n";
  content += dSep + "\n";

  // Trigger browser download with hardened sync-safe cleanup
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.txt`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  
  // Safe Cleanup
  if (link.parentNode) {
    document.body.removeChild(link);
  }
  URL.revokeObjectURL(url);
}

// Keep legacy export name to avoid breaking some imports but redirect logic
export const exportToCSV = exportAsReceiptText;
