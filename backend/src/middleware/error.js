const multer = require('multer');
const { HttpError } = require('../utils/httpError');

exports.notFound = (req, res) => res.status(404).json({ pesan: 'Endpoint tidak ditemukan.', kode: 'TIDAK_ADA' });

// eslint-disable-next-line no-unused-vars
exports.onError = (err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ pesan: err.message, kode: err.kode });
  if (err instanceof multer.MulterError) {
    // Batas ukuran berbeda per rute (foto profil 2 MB, bukti pengajuan 5 MB);
    // middleware upload menandai req.batasUkuranMB agar pesannya tidak menyesatkan.
    const batas = req.batasUkuranMB || 2;
    return res.status(400).json({
      pesan: err.code === 'LIMIT_FILE_SIZE' ? `Ukuran foto maksimal ${batas} MB.` : 'Upload gagal.',
      kode: 'UPLOAD',
    });
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ pesan: 'Data sudah terdaftar (email, username, atau data harian yang sama).', kode: 'DUPLIKAT' });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ pesan: err.errors.map((e) => e.message).join(', '), kode: 'VALIDASI' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ pesan: 'Format JSON tidak valid.', kode: 'VALIDASI' });
  console.error(err);
  res.status(500).json({ pesan: 'Terjadi kesalahan di server.', kode: 'SERVER' });
};
