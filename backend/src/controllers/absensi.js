const { Op } = require('sequelize');
const env = require('../config/env');
const {
  sequelize, TokenPembimbing, Absensi, FaceTemplate, Peserta, Pembimbing, User, Workshift,
} = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');
const { sha256, acak, dec } = require('../utils/crypto');
const { bagian, hitungStatus, rentang, menitDariJam } = require('../utils/waktu');
const audit = require('../utils/audit');
const pengaturan = require('../services/pengaturan');
const liveness = require('../services/liveness');

const jenisOk = (j) => {
  if (!['masuk', 'pulang'].includes(j)) throw new HttpError(400, 'Jenis absen harus masuk atau pulang.', 'VALIDASI');
  return j;
};

// Hari yang tercatat Izin/Sakit tidak perlu dan tidak boleh diikuti absensi QR/wajah;
// slot absen masuk sudah dipakai baris keterangan, dan absen pulang juga tidak relevan.
const cekTerkunci = async (user_id, tanggal, nama) => {
  if (await Absensi.findOne({ where: { user_id, tanggal, status: { [Op.in]: ['Izin', 'Sakit'] } } })) {
    throw new HttpError(409, `${nama || 'Hari ini'} tercatat Izin/Sakit — absensi tidak diperlukan.`, 'HARI_TERCATAT');
  }
};

const jadwalHari = async (hari) => {
  const ws = await Workshift.findOne({ where: { hari } });
  if (!ws || !ws.hari_kerja) throw new HttpError(422, 'Hari ini bukan hari kerja.', 'HARI_LIBUR');
  return ws;
};

// Absen pulang dibuka 5 menit sebelum jam pulang (server, bukan perangkat klien,
// yang menentukan waktu). PERIODE_PULANG_MENIT juga dipakai si tes.
const PERIODE_PULANG_MENIT = 5;
const bukaPulang = (ws) => menitDariJam(ws.jam_pulang) - PERIODE_PULANG_MENIT;
const cekWaktuPulang = (jen, ws, w) => {
  if (jen !== 'pulang') return;
  if (w.menit < bukaPulang(ws)) {
    const jamBuka = `${String(Math.floor(bukaPulang(ws) / 60)).padStart(2, '0')}:${String((bukaPulang(ws) % 60)).padStart(2, '0')}`;
    throw new HttpError(422, `Absen pulang dibuka mulai ${jamBuka} (${PERIODE_PULANG_MENIT} menit sebelum jam pulang).`, 'PULANG_BELUM_WAKTUNYA');
  }
};

/* ---------- Peserta ---------- */

// Pembimbing menayangkan QR berotasi 30 detik; peserta yang memindai lalu kirim
// hasil wajahnya. Server yang menentukan waktu dan status (lihat konfirmasiScan).
exports.tayangkanQr = asyncH(async (req, res) => {
  const now = new Date();
  await TokenPembimbing.update(
    { kedaluwarsa_pada: now },
    { where: { pembimbing_id: req.user.id, dipakai_pada: null, kedaluwarsa_pada: { [Op.gt]: now } } },
  );
  const mentah = acak();
  const kedaluwarsa = new Date(now.getTime() + env.qrTtl * 1000);
  await TokenPembimbing.create({
    token_hash: sha256(mentah), pembimbing_id: req.user.id, kedaluwarsa_pada: kedaluwarsa,
  });
  res.status(201).json({ token: mentah, berlaku_detik: env.qrTtl, kedaluwarsa_pada: kedaluwarsa });
});

// Metode wajah: absensi langsung tanpa QR, setelah embedding cocok dan liveness lolos.
// Server yang menentukan waktu (bagian()), status, dan jenis — klien hanya mengirim embedding.
exports.wajah = asyncH(async (req, res) => {
  const { embedding, jenis, nonce } = req.body;
  const uid = req.user.id;
  const jen = jenisOk(jenis);
  const cfg = await pengaturan.dapatkan();

  // Absen pulang lewat wajah (tanpa QR) apapun metode globalnya; cek mode hanya untuk masuk.
  if (cfg.metode !== 'wajah' && jen !== 'pulang') {
    throw new HttpError(409, 'Metode absensi saat ini tidak memakai verifikasi wajah langsung.', 'MODE_WAJAH_NONAKTIF');
  }

  const tpl = await FaceTemplate.findOne({ where: { user_id: uid } });
  if (!tpl) throw new HttpError(412, 'Template wajah belum terdaftar.', 'TEMPLATE_BELUM');
  const valid = (a) => Array.isArray(a) && a.length === env.face.dim && a.every(Number.isFinite);
  const jarak = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  if (!valid(embedding)) {
    throw new HttpError(422, 'Wajah tidak terbaca. Hadap lurus ke kamera dan cari cahaya yang cukup.', 'WAJAH_TIDAK_TERBACA');
  }

  const w = bagian();
  const ws = await jadwalHari(w.hari);
  cekWaktuPulang(jen, ws, w);
  await cekTerkunci(uid, w.tanggal);
  if (await Absensi.findOne({ where: { user_id: uid, tanggal: w.tanggal, jenis: jen } })) {
    throw new HttpError(409, `Absen ${jen} hari ini sudah tercatat.`, 'SUDAH_ABSEN');
  }
  if (jen === 'pulang' && !(await Absensi.findOne({ where: { user_id: uid, tanggal: w.tanggal, jenis: 'masuk' } }))) {
    throw new HttpError(422, 'Anda belum absen masuk hari ini.', 'BELUM_ABSEN_MASUK');
  }

  const jarakWajah = jarak(embedding, dec(tpl.embedding)); // jarak saja yang dicatat, bukanembedding
  if (jarakWajah > env.face.threshold) {
    await audit(req, 'Absensi wajah gagal', jen, { jarak: Number(jarakWajah.toFixed(4)), ambang: env.face.threshold });
    throw new HttpError(422, 'Wajah tidak cocok dengan template yang terdaftar.', 'WAJAH_TIDAK_COCOK');
  }

  const status = hitungStatus(jen, ws, w);
  try {
    await sequelize.transaction(async (t) => {
      if (cfg.liveness_aktif) await liveness.periksa(uid, nonce, t);
      await Absensi.create({
        user_id: uid, tanggal: w.tanggal, jenis: jen, jam: w.jam, status,
        metode: 'Wajah',
      }, { transaction: t });
    });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, `Absen ${jen} hari ini sudah tercatat.`, 'SUDAH_ABSEN');
    }
    throw e;
  }
  await audit(req, `Absensi wajah ${jen}`, status);
  res.json({ pesan: 'Absensi tercatat.', jam: w.jam, status });
});

// Metode qr/qr_wajah: peserta memindai QR pembimbing lalu mengirim hasil wajah
// (qr_wajah) atau langsung (qr). Waktu dan status dihitung server dari momen ini.
exports.konfirmasiScan = asyncH(async (req, res) => {
  const { token, embedding, nonce } = req.body;
  const jen = jenisOk(req.body.jenis);
  const uid = req.user.id;
  const cfg = await pengaturan.dapatkan();

  if (cfg.metode === 'wajah') {
    throw new HttpError(409, 'Metode absensi saat ini tidak memakai QR. Gunakan verifikasi wajah.', 'MODE_QR_NONAKTIF');
  }

  const tidakValid = () => new HttpError(404, 'Kode ini bukan QR absensi Astakira Media.', 'QR_TIDAK_VALID');
  if (typeof token !== 'string' || token.length < 10 || token.length > 100) throw tidakValid();
  const tok = await TokenPembimbing.findOne({ where: { token_hash: sha256(token) } });
  if (!tok) throw tidakValid();
  if (tok.dipakai_pada) throw new HttpError(409, 'QR ini sudah dipakai. Minta pembimbing menayangkan QR baru.', 'QR_SUDAH_DIPAKAI');
  if (new Date(tok.kedaluwarsa_pada).getTime() <= Date.now()) {
    throw new HttpError(410, 'QR kedaluwarsa. Minta pembimbing menayangkan QR baru.', 'QR_KEDALUWARSA');
  }
  const pmb = await Pembimbing.findOne({ where: { user_id: tok.pembimbing_id }, include: [{ model: User, as: 'user' }] });
  if (!pmb || !pmb.user.aktif) throw tidakValid();

  const prof = await Peserta.findOne({ where: { user_id: uid } });
  if (prof && prof.pembimbing_id && prof.pembimbing_id !== tok.pembimbing_id) {
    throw new HttpError(403, 'Peserta ini tidak berada di bawah bimbingan pembimbing pemberi QR.', 'BUKAN_BIMBINGAN');
  }

  const w = bagian();
  // Cek hari tercatat lebih dulu: peserta yang hari tertulis Izin/Sakit harus
  // menerima HARI_TERCATAT, bukan penjelasan teknis PULANG_WAJAH/HARI_LIBUR.
  await cekTerkunci(uid, w.tanggal);
  // Absen pulang selalu lewat wajah tanpa QR (lihat exports.wajah).
  if (jen === 'pulang') {
    throw new HttpError(422, 'Absen pulang dilakukan dengan verifikasi wajah, tanpa QR. Buka menu absensi lalu pilih Absen pulang.', 'PULANG_WAJAH');
  }
  const ws = await jadwalHari(w.hari);
  if (await Absensi.findOne({ where: { user_id: uid, tanggal: w.tanggal, jenis: jen } })) {
    throw new HttpError(409, `Absen ${jen} hari ini sudah tercatat.`, 'SUDAH_ABSEN');
  }
  if (jen === 'pulang' && !(await Absensi.findOne({ where: { user_id: uid, tanggal: w.tanggal, jenis: 'masuk' } }))) {
    throw new HttpError(422, 'Anda belum absen masuk hari ini.', 'BELUM_ABSEN_MASUK');
  }

  let cocok = false;
  let jarakWajah = null;
  if (cfg.metode === 'qr_wajah') {
    const tpl = await FaceTemplate.findOne({ where: { user_id: uid } });
    if (!tpl) throw new HttpError(412, 'Template wajah belum terdaftar.', 'TEMPLATE_BELUM');
    const valid = (a) => Array.isArray(a) && a.length === env.face.dim && a.every(Number.isFinite);
    const jarak = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
    if (!valid(embedding)) {
      throw new HttpError(422, 'Wajah tidak terbaca. Hadap lurus ke kamera dan cari cahaya yang cukup.', 'WAJAH_TIDAK_TERBACA');
    }
    const hitung = jarak(embedding, dec(tpl.embedding));
    jarakWajah = hitung;
    cocok = hitung <= env.face.threshold;
    if (!cocok) {
      // Jarak kegagalan dicatat (angka tunggal, bukan data biometrik) sebagai dasar
      // penyetelan FACE_THRESHOLD dengan wajah nyata.
      await audit(req, 'Absensi scan wajah gagal', jen, {
        jarak: Number(jarakWajah.toFixed(4)), ambang: env.face.threshold,
      });
      throw new HttpError(422, 'Wajah tidak cocok dengan template yang terdaftar.', 'WAJAH_TIDAK_COCOK');
    }
  }

  const status = hitungStatus(jen, ws, w);
  const metode = cfg.metode === 'qr_wajah' ? 'QR+Wajah' : 'QR';
  try {
    await sequelize.transaction(async (t) => {
      const [n] = await TokenPembimbing.update(
        { dipakai_pada: new Date() }, { where: { id: tok.id, dipakai_pada: null }, transaction: t },
      );
      if (!n) throw new HttpError(409, 'QR ini sudah dipakai. Minta pembimbing menayangkan QR baru.', 'QR_SUDAH_DIPAKAI'); // dua scan bersamaan
      if (cfg.metode === 'qr_wajah' && cfg.liveness_aktif) await liveness.periksa(uid, nonce, t);
      await Absensi.create({
        user_id: uid, tanggal: w.tanggal, jenis: jen, jam: w.jam, status,
        metode, token_id: tok.id, dikonfirmasi_oleh: tok.pembimbing_id,
      }, { transaction: t });
    });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, `Absen ${jen} hari ini sudah tercatat.`, 'SUDAH_ABSEN');
    }
    throw e;
  }
  await audit(req, `Absensi scan pembimbing ${jen}`, `${status} | pemb#${tok.pembimbing_id}`,
    cocok ? { jarak: Number(jarakWajah.toFixed(4)), ambang: env.face.threshold } : null);
  res.json({ pesan: 'Absensi tercatat.', jam: w.jam, status, metode });
});

exports.riwayat = asyncH(async (req, res) => {
  const where = { user_id: req.user.id };
  const r = rentang(req.query);
  if (r) where.tanggal = r;
  const data = await Absensi.findAll({
    where, order: [['tanggal', 'DESC'], ['jenis', 'ASC']], limit: 366,
    attributes: ['id', 'tanggal', 'jenis', 'jam', 'status', 'metode', 'keterangan'],
  });
  res.json({ data });
});

