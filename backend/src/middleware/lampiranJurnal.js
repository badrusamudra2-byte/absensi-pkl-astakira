const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { HttpError } = require('../utils/httpError');

const dir = path.join(__dirname, '../../uploads/lampiran');
fs.mkdirSync(dir, { recursive: true });

const MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Deteksi isi berkas lewat magic bytes — tipe MIME dari klien bisa dipalsukan. */
const tandaIsi = (buf) => {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'; // JPEG
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('binary', 1, 4) === 'PNG') return 'png';
  if (buf.length > 12 && buf.toString('binary', 0, 4) === 'RIFF' && buf.toString('binary', 8, 12) === 'WEBP') return 'webp';
  return null;
};

/** Lampiran foto kegiatan jurnal: opsional — boleh tanpa berkas. Kolom form
 * bernama 'lampiran'; maks 5 MB; disimpan acak di uploads/lampiran/. */
module.exports = [
  (req, res, next) => { req.batasUkuranMB = 5; next(); }, // untuk pesan galat LIMIT_FILE_SIZE
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('lampiran'),
  (req, res, next) => {
    try {
      const berkas = req.file;
      if (!berkas) return next(); // opsional: tanpa berkas tetap sah (dipakai untuk hapus/isi teks saja)
      const ext = MIME[berkas.mimetype];
      if (!ext) throw new HttpError(422, 'Lampiran harus berformat JPG, PNG, atau WebP.', 'UPLOAD');
      if (tandaIsi(berkas.buffer) !== ext) {
        throw new HttpError(422, 'Isi berkas bukan gambar JPG, PNG, atau WebP yang sah.', 'UPLOAD');
      }
      berkas.filename = crypto.randomBytes(16).toString('hex') + '.' + ext;
      fs.writeFileSync(path.join(dir, berkas.filename), berkas.buffer, { mode: 0o644 });
      next();
    } catch (e) {
      if (req.file?.buffer) req.file.buffer = null; // buang isi ingatan segera
      next(e);
    }
  },
];
