const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { User } = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');
const { kuat, pesanSandi } = require('../utils/validasi');
const audit = require('../utils/audit');

exports.password = asyncH(async (req, res) => {
  const { password_lama: lama, password_baru: baru } = req.body;
  const u = await User.unscoped().findByPk(req.user.id);
  if (!(typeof lama === 'string' && (await bcrypt.compare(lama, u.password_hash)))) {
    throw new HttpError(400, 'Kata sandi saat ini salah.', 'KREDENSIAL');
  }
  if (!kuat(baru)) throw new HttpError(400, pesanSandi, 'VALIDASI');
  await u.update({ password_hash: await bcrypt.hash(baru, 12) });
  await audit(req, 'Ubah kata sandi');
  res.json({ pesan: 'Kata sandi diubah.' });
});

exports.foto = asyncH(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Pilih file foto terlebih dulu.', 'VALIDASI');
  const lama = req.user.foto_url;
  try {
    await req.user.update({ foto_url: '/uploads/foto/' + req.file.filename });
  } catch (e) {
    // Gagal simpan: berkas baru jangan jadi yatim di disk
    try { fs.unlinkSync(path.join(__dirname, '../../uploads/foto', req.file.filename)); } catch { /* sudah tak ada */ }
    throw e;
  }
  // Hapus berkas lama hanya bila path-nya memang milik folder foto profil
  // (jaga-jaga bila kolom foto_url pernah ternodai).
  if (lama && lama.startsWith('/uploads/foto/')) fs.unlink(path.join(__dirname, '../..', lama), () => {});
  res.json({ foto_url: req.user.foto_url });
});
