const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { User } = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');
const { kuat } = require('../utils/validasi');
const audit = require('../utils/audit');

exports.password = asyncH(async (req, res) => {
  const { password_lama: lama, password_baru: baru } = req.body;
  const u = await User.unscoped().findByPk(req.user.id);
  if (!(typeof lama === 'string' && (await bcrypt.compare(lama, u.password_hash)))) {
    throw new HttpError(400, 'Kata sandi saat ini salah.', 'KREDENSIAL');
  }
  if (!kuat(baru)) throw new HttpError(400, 'Kata sandi baru minimal 8 karakter.', 'VALIDASI');
  await u.update({ password_hash: await bcrypt.hash(baru, 12) });
  await audit(req, 'Ubah kata sandi');
  res.json({ pesan: 'Kata sandi diubah.' });
});

exports.foto = asyncH(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Pilih file foto terlebih dulu.', 'VALIDASI');
  const lama = req.user.foto_url;
  await req.user.update({ foto_url: '/uploads/foto/' + req.file.filename });
  if (lama) fs.unlink(path.join(__dirname, '../..', lama), () => {});
  res.json({ foto_url: req.user.foto_url });
});
