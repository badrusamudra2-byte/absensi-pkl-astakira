const { HttpError } = require('./httpError');

// Kebijakan sandi: 8-72 karakter (batas bcrypt 72 byte), huruf + angka wajib.
exports.pesanSandi = 'Kata sandi minimal 8 karakter dan mengandung huruf serta angka.';
exports.kuat = (p) =>
  typeof p === 'string' && p.length >= 8 && p.length <= 72 && /[a-zA-Z]/.test(p) && /\d/.test(p);

exports.wajib = (v, maks, nama = 'Nama') => {
  const s = String(v ?? '').trim();
  if (!s || s.length > maks) throw new HttpError(400, `${nama} wajib diisi (maksimal ${maks} karakter).`, 'VALIDASI');
  return s;
};

// "08:00" atau "08:00:00" -> "08:00:00", selain itu null
exports.jam = (s) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(String(s));
  return m ? `${m[1]}:${m[2]}:${m[3] || '00'}` : null;
};

exports.email = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(s) || s.length > 120) throw new HttpError(400, 'Email tidak valid.', 'VALIDASI');
  return s;
};
