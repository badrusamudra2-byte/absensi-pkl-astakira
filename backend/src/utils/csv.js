// Sel yang diawali = + - @ diberi tanda ' agar tidak dieksekusi sebagai rumus di Excel
const sel = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
module.exports = (head, rows) => '\uFEFF' + [head, ...rows].map((r) => r.map(sel).join(',')).join('\r\n');
