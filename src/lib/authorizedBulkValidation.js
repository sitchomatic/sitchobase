const MAX_ROWS = 100;
const MAX_CONCURRENCY = 3;

export function normalizeBulkRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .slice(0, MAX_ROWS)
    .map((row, index) => ({
      index,
      username: String(row.username || row.email || '').trim(),
      password: String(row.password || '').trim(),
      raw: row,
    }))
    .filter((row) => row.username && row.password);
}

export function validateAuthorizedBulkConfig({ targetUrl, usernameSelector, passwordSelector, submitSelector, confirmedAuthorization, rows }) {
  const errors = [];
  if (!confirmedAuthorization) errors.push('Confirm you own or have written permission to test this target.');
  if (!targetUrl || !/^https:\/\//i.test(targetUrl)) errors.push('Use a valid HTTPS target URL.');
  if (!usernameSelector?.trim()) errors.push('Username selector is required.');
  if (!passwordSelector?.trim()) errors.push('Password selector is required.');
  if (!submitSelector?.trim()) errors.push('Submit button selector is required.');
  if (!rows?.length) errors.push('Upload a CSV with username/email and password columns.');
  return errors;
}

export function clampConcurrency(value) {
  const n = Number(value) || 1;
  return Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(n)));
}

export { MAX_ROWS, MAX_CONCURRENCY };