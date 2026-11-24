const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { FaceTemplate, FaceVerification, QrToken, TantanganWajah, User, Absensi, sequelize } = require('../models');
const env = require('../config/env');
const { HttpError, asyncH } = require('../utils/httpError');
const { enc, dec } = require('../utils/crypto');
const { bagian } = require('../utils/waktu');
const siapkanFoto = require('../utils/foto');
const audit = require('../utils/audit');
const liveness = require('../services/liveness');
const pengaturan = require('../services/pengaturan');
const { jadwalHari, cekWaktuPulang } = require('./absensi').kisiWaktu;

const valid = (a) => Array.isArray(a) && a.length === env.face.dim && a.every(Number.isFinite);
const jarak = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
const TIDAK_TERBACA = ['Wajah tidak terbaca. Hadap lurus ke kamera dan cari cahaya yang cukup.', 'WAJAH_TIDAK_TERBACA'];

exports.enroll = asyncH(async (req, res) => {
  const { embedding, persetujuan } = req.body;
  if (persetujuan !== true) {
    throw new HttpError(422, 'Beri tanda persetujuan penggunaan data wajah terlebih dahulu.', 'PERSETUJUAN_WAJIB');
  }
  if (!valid(embedding)) throw new HttpError(422, ...TIDAK_TERBACA);
  if (await FaceTemplate.findOne({ where: { user_id: req.user.id } })) {
    throw new HttpError(409, 'Template wajah sudah terdaftar. Hubungi admin untuk mendaftar ulang.', 'TEMPLATE_ADA');
  }
  await FaceTemplate.create({ user_id: req.user.id, embedding: enc(embedding), disetujui_pada: new Date() });
  await audit(req, 'Daftar template wajah');
  res.status(201).json({ pesan: 'Template wajah terdaftar.' });
});

// Status pendaftaran untuk halaman absensi: agar peserta tahu sebelum kamera menyala.
// Tidak mengirim data biometrik apa pun — hanya true/false.
exports.cekTemplate = asyncH(async (req, res) => {
  res.json({ terdaftar: !!(await FaceTemplate.findOne({ where: { user_id: req.user.id } })) });
});

// Peserta menghapus template wajahnya sendiri agar dapat mendaftar ulang tanpa admin.
// Konfirmasi kata sandi wajib: tanpa ini siapa pun yang sempat memakai HP bisa
// mengganti biometrik pemilik akun.
exports.resetSendiri = asyncH(async (req, res) => {
  const sandi = req.body && typeof req.body.kata_sandi === 'string' ? req.body.kata_sandi : '';
  if (!sandi) throw new HttpError(422, 'Masukkan kata sandi untuk mengonfirmasi reset.', 'VALIDASI');

  const u = await User.findByPk(req.user.id, { attributes: ['id', 'password_hash'] });
  if (!u || !(await bcrypt.compare(sandi, u.password_hash))) {
    throw new HttpError(403, 'Kata sandi salah. Reset template dibatalkan.', 'SANDI_SALAH');
  }

  const hasil = await sequelize.transaction(async (t) => {
    const n = await FaceTemplate.destroy({ where: { user_id: u.id }, transaction: t });
    if (!n) throw new HttpError(404, 'Template wajah belum terdaftar.', 'TIDAK_ADA');
    // Template lama sudah tidak berlaku: batalkan verifikasi, QR, dan tantangan yang masih mengambang.
    await FaceVerification.destroy({ where: { user_id: u.id }, transaction: t });
    await QrToken.destroy({ where: { user_id: u.id }, transaction: t });
    await TantanganWajah.destroy({ where: { user_id: u.id }, transaction: t });
    return n;
  });

  await audit(req, 'Reset template wajah (mandiri)');
  res.json({ pesan: 'Template wajah dihapus. Silakan daftar ulang.', dihapus: hasil });
});

// Tantangan hanya untuk peserta memverifikasi wajahnya sendiri di HP-nya. Wajah yang
// dibandingkan, foto, dan pesan absensi milik peserta terkait.
exports.tantangan = asyncH(async (req, res) => {
  if (!(await FaceTemplate.findOne({ where: { user_id: req.user.id } }))) {
    throw new HttpError(412, 'Template wajah belum terdaftar.', 'TEMPLATE_BELUM');
  }
  const t = await liveness.buat(req.user.id);
  res.json({
    nonce: t.nonce,
    kode_gerakan: t.kode_gerakan,
    instruksi: liveness.teksGerakan(t.kode_gerakan),
    kedaluwarsa_pada: t.kedaluwarsa_pada,
    berlaku_detik: t.berlaku_detik,
  });
});

/** Ubahan peserta: { jenis, embedding, nonce?, foto? }.
 * Bila liveness_aktif: nonce wajib, sekali pakai, dan kedaluwarsa (mode A).
 * Bila liveness mati: verifikasi wajah berjalan tanpa tantangan.
 * Bila foto disertakan: JPEG (base64/data URL) divalidasi, dienkripsi, dan disimpan
 * pada verifikasi — dipindahkan ke absensi saat pembimbing memindai QR peserta
 * (atau langsung saat absensi wajah). Tidak pernah dikirim balik ke klien. */

exports.verify = asyncH(async (req, res) => {
  const { embedding, jenis, nonce, foto } = req.body;
  if (!['masuk', 'pulang'].includes(jenis)) throw new HttpError(400, 'Jenis absen harus masuk atau pulang.', 'VALIDASI');
  // Pulang belum waktunya ditolak di sini (bukan hanya saat pembimbing memindai):
  // peserta tidak perlu menghabiskan verifikasi wajah sebelum jendela pulang dibuka.
  if (jenis === 'pulang') {
    const w = bagian();
    cekWaktuPulang('pulang', await jadwalHari(w.hari), w);
  }
  // Hari yang tercatat Izin/Sakit tidak boleh diikuti absensi QR/wajah — tolak di awal
  // agar peserta yang lupa langsung tahu, bukan setelah QR-nya dipindai pembimbing.
  if (await Absensi.findOne({
    where: { user_id: req.user.id, tanggal: bagian().tanggal, status: { [Op.in]: ['Izin', 'Sakit'] } },
  })) {
    throw new HttpError(409, 'Hari ini tercatat Izin/Sakit — absensi tidak diperlukan.', 'HARI_TERCATAT');
  }
  const cfg = await pengaturan.dapatkan();
  const tpl = await FaceTemplate.findOne({ where: { user_id: req.user.id } });
  if (!tpl) throw new HttpError(412, 'Template wajah belum terdaftar.', 'TEMPLATE_BELUM');
  if (!valid(embedding)) throw new HttpError(422, ...TIDAK_TERBACA);

  // Template tersimpan harus berbentuk sah (array finite sepanjang dim) — sama
  // dengan absensi wajah langsung; tanpa ini jarak bisa NaN tanpa pesan jelas.
  const tplVektor = dec(tpl.embedding);
  if (!valid(tplVektor)) {
    throw new HttpError(500, 'Template wajah tidak sah. Hubungi admin untuk mendaftar ulang wajah.', 'TEMPLATE_RUSAK');
  }
  const cocok = jarak(embedding, tplVektor) <= env.face.threshold;

  // Urutan: pengecekan kecocokan dulu (gagal cepat), baru nonce dihabiskan.
  if (!cocok) {
    await audit(req, 'Verifikasi wajah gagal', jenis);
    throw new HttpError(422, 'Wajah tidak cocok dengan template yang terdaftar.', 'WAJAH_TIDAK_COCOK');
  }

  const fotoCt = siapkanFoto(foto);

  await sequelize.transaction(async (t) => {
    if (cfg.liveness_aktif) await liveness.periksa(req.user.id, nonce, t);
    await FaceVerification.create(
      {
        user_id: req.user.id, jenis, kedaluwarsa_pada: new Date(Date.now() + env.face.ttl * 1000),
        foto_ciphertext: fotoCt,
      },
      { transaction: t },
    );
  });

  await audit(req, 'Verifikasi wajah berhasil', jenis);
  res.json({ pesan: 'Wajah terverifikasi.', berlaku_detik: env.face.ttl });
});

/** Cek kesiapan template; dipakai bersama controller absensi. */
exports.kisi = { valid, jarak };
