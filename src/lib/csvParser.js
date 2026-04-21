/**
 * Parse a CSV file into an array of objects keyed by header row.
 * Handles quoted fields, commas inside quotes, and CRLF/LF line endings.
 */
export function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = splitCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = splitCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (values[i] ?? '').trim(); });
    return row;
  });

  return { headers: headers.map(h => h.trim()), rows };
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Extract all {{placeholder}} names from a script string.
 */
export function extractPlaceholders(script) {
  const matches = script.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map(m => m[1]))];
}

/**
 * Substitute {{placeholder}} tokens in a script with values from a CSV row object.
 */
export function interpolate(script, row) {
  return script.replace(/\{\{(\w+)\}\}/g, (_, key) => row[key] ?? `{{${key}}}`);
}