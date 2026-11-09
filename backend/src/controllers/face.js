const { FaceTemplate, FaceVerification, sequelize } = require('../models');
const env = require('../config/env');
const { HttpError, asyncH } = require('../utils/httpError');
const { enc, dec } = require('../utils/crypto');
const audit = require('../utils/audit');
const liveness = require('../services/liveness');
const pengaturan = require('../services/pengaturan');

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

/** Ubahan peserta: { jenis, embedding, nonce? }.
 * Bila liveness_aktif: nonce wajib, sekali pakai, dan kedaluwarsa (mode A).
 * Bila liveness mati: verifikasi wajah berjalan tanpa tantangan. */
exports.verify = asyncH(async (req, res) => {
  const { embedding, jenis, nonce } = req.body;
  if (!['masuk', 'pulang'].includes(jenis)) throw new HttpError(400, 'Jenis absen harus masuk atau pulang.', 'VALIDASI');
  const cfg = await pengaturan.dapatkan();
  const tpl = await FaceTemplate.findOne({ where: { user_id: req.user.id } });
  if (!tpl) throw new HttpError(412, 'Template wajah belum terdaftar.', 'TEMPLATE_BELUM');
  if (!valid(embedding)) throw new HttpError(422, ...TIDAK_TERBACA);

  const cocok = jarak(embedding, dec(tpl.embedding)) <= env.face.threshold;

  // Urutan: pengecekan kecocokan dulu (gagal cepat), baru nonce dihabiskan.
  if (!cocok) {
    await audit(req, 'Verifikasi wajah gagal', jenis);
    throw new HttpError(422, 'Wajah tidak cocok dengan template yang terdaftar.', 'WAJAH_TIDAK_COCOK');
  }

  await sequelize.transaction(async (t) => {
    if (cfg.liveness_aktif) await liveness.periksa(req.user.id, nonce, t);
    await FaceVerification.create(
      { user_id: req.user.id, jenis, kedaluwarsa_pada: new Date(Date.now() + env.face.ttl * 1000) },
      { transaction: t },
    );
  });

  await audit(req, 'Verifikasi wajah berhasil', jenis);
  res.json({ pesan: 'Wajah terverifikasi.', berlaku_detik: env.face.ttl });
});

/** Cek kesiapan template; dipakai bersama controller absensi. */
exports.kisi = { valid, jarak };
