/* eslint-disable no-control-regex */
// Convert array of objects to CSV string and trigger browser download.
export function exportToCsv(filename, rows, headers) {
  if (!rows || rows.length === 0) return false;
  const keys = headers || Object.keys(rows[0]);
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'object') val = JSON.stringify(val);
    const str = String(val).replace(/"/g, '""');
    return /[",\n\r]/.test(str) ? `"${str}"` : str;
  };
  const csv = [
    keys.join(','),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(',')),
  ].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

// Minimal CSV parser that handles quoted values, embedded commas and newlines.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  // strip BOM and trailing empty rows
  if (rows.length && rows[0][0]?.charCodeAt(0) === 0xFEFF) rows[0][0] = rows[0][0].slice(1);
  while (rows.length && rows[rows.length - 1].every((c) => c === '')) rows.pop();
  if (rows.length === 0) return [];
  const headers = rows.shift().map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ''])));
}
