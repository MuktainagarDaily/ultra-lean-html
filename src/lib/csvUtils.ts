/**
 * Shared CSV utilities for the admin panel.
 *
 * Replaces three duplicate copies of parseCsv/parseCsvLine and four inline
 * CSV download blocks (Shops, Categories, Analytics, Requests).
 *
 * Non-technical summary:
 *   - parseCsv: turns CSV text into a list of row objects keyed by column name.
 *   - downloadCsv: triggers a browser download of a UTF-8 CSV with BOM
 *     (so Excel opens it cleanly with non-ASCII characters like Marathi text).
 */

/** Parse a single CSV line, respecting quoted fields and escaped quotes (""). */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse full CSV text into row objects.
 * Headers are lowercased + trimmed so column lookup is case-insensitive.
 * Returns [] when the CSV has no data rows.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (vals[i] ?? '').trim();
    });
    return obj;
  });
}

/** Escape one CSV cell value: wrap in quotes and double-up internal quotes. */
function escapeCell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/**
 * Trigger a browser download of a CSV file.
 *
 * - filename: file basename (date suffix added automatically)
 * - headers: column header row
 * - rows: array of row arrays (same length as headers)
 *
 * Encoded as UTF-8 with BOM so Excel renders Marathi/Devanagari correctly.
 */
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateSuffix = new Date().toISOString().slice(0, 10);
  a.download = filename.includes('.csv')
    ? filename.replace('.csv', `-${dateSuffix}.csv`)
    : `${filename}-${dateSuffix}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
