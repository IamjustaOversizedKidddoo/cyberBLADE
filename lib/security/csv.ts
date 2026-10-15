/**
 * One CSV cell, safe to open in a spreadsheet (L1-A-23): a leading = + - @ tab or CR is neutralised
 * with an apostrophe (formula injection), and any comma, quote, CR or LF forces quoting.
 */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
