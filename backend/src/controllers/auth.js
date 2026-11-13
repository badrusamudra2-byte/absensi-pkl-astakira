const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const env = require('../config/env');
const { User, Peserta, Pembimbing } = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');
const { kuat, pesanSandi } = require('../utils/validasi');
const { sha256, acak } = require('../utils/crypto');
const mail = require('../utils/mailer');
const audit = require('../utils/audit');

// Cost harus sama dengan hash asli (12) agar waktu respons "akun tidak terdaftar"
// tidak bisa dibedakan dari "salah sandi" lewat timing.
const DUMMY = bcrypt.hashSync('tidak-dipakai', 12);
const pub = (u) => ({ id: u.id, nama: u.nama, username: u.username, email: u.email, role: u.role, foto_url: u.foto_url });

exports.login = asyncH(async (req, res) => {
  const id = String(req.body.identifier || '').trim().toLowerCase();
  const pw = String(req.body.password || '');
  if (!id || !pw) throw new HttpError(400, 'Email/username dan kata sandi wajib diisi.', 'VALIDASI');

  const u = await User.unscoped().findOne({ where: { [Op.or]: [{ email: id }, { username: id }] } });
  const cocok = await bcrypt.compare(pw, u ? u.password_hash : DUMMY);
  if (!u || !cocok) throw new HttpError(401, 'Email/username atau kata sandi salah.', 'KREDENSIAL');
  if (!u.aktif) throw new HttpError(403, 'Akun Anda nonaktif. Hubungi admin.', 'NONAKTIF');

  req.user = u;
  await audit(req, 'Login');
  const token = jwt.sign({ sub: u.id, role: u.role }, env.jwtSecret, { expiresIn: env.jwtExpires });
  res.json({ token, user: pub(u) });
});

exports.me = asyncH(async (req, res) => {
  let profil = null;
  if (req.user.role === 'peserta') {
    profil = await Peserta.findOne({
      where: { user_id: req.user.id },
      include: [{ model: User, as: 'pembimbing', attributes: ['id', 'nama'] }],
    });
  } else if (req.user.role === 'pembimbing') {
    profil = await Pembimbing.findOne({ where: { user_id: req.user.id } });
  }
  res.json({ user: pub(req.user), profil });
});

exports.lupa = asyncH(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const u = email ? await User.unscoped().findOne({ where: { email, aktif: true } }) : null;
  if (u) {
    const mentah = acak(32);
    await u.update({ reset_token_hash: sha256(mentah), reset_expires: new Date(Date.now() + 30 * 60 * 1000) });
    await mail
      .kirim({
        to: u.email,
        subject: 'Atur ulang kata sandi',
        text: `Halo ${u.nama},\n\nBuka tautan ini dalam 30 menit untuk membuat kata sandi baru:\n${env.frontendUrl}/reset-password?token=${mentah}\n\nAbaikan email ini jika Anda tidak memintanya.`,
      })
      .catch((e) => console.error('Email gagal dikirim:', e.message));
  }
  // Jawaban selalu sama agar orang luar tidak bisa menebak email yang terdaftar
  res.json({ pesan: 'Jika email terdaftar, tautan atur ulang sudah dikirim.' });
});

exports.reset = asyncH(async (req, res) => {
  const { token, password } = req.body;
  if (typeof token !== 'string' || !kuat(password)) {
    throw new HttpError(400, `Token wajib ada, dan ${pesanSandi.toLowerCase()}.`, 'VALIDASI');
  }
  const u = await User.unscoped().findOne({
    where: { reset_token_hash: sha256(token), reset_expires: { [Op.gt]: new Date() } },
  });
  if (!u) throw new HttpError(400, 'Tautan tidak valid atau sudah kedaluwarsa.', 'TOKEN_RESET');
  await u.update({ password_hash: await bcrypt.hash(password, 12), reset_token_hash: null, reset_expires: null });
  req.user = u;
  await audit(req, 'Reset kata sandi');
  res.json({ pesan: 'Kata sandi berhasil diubah. Silakan login.' });
});
