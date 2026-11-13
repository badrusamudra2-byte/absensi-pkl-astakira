const { Op } = require('sequelize');
const env = require('../config/env');
const {
  sequelize, QrToken, Absensi, FaceTemplate, FaceVerification, WajahFoto, User, Workshift,
} = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');
const { sha256, acak, dec } = require('../utils/crypto');
const { bagian, hitungStatus, rentang, menitDariJam } = require('../utils/waktu');
const audit = require('../utils/audit');
const pengaturan = require('../services/pengaturan');
const liveness = require('../services/liveness');
const siapkanFoto = require('../utils/foto');
const { bacaLokasi, sahkanLokasi } = require('../utils/lokasi');
const live = require('./live');

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

// Baris 'Tidak hadir' (metode Otomatis) dari job tutup hari hanyalah penanda,
// bukan absensi sungguhan. Bila peserta ternyata datang (telat), penanda diganti
// absensi nyata — tercatat jujur sebagai Terlambat, bukan ditolak "sudah tercatat".
const penandaOtomatis = (a) => !!a && a.status === 'Tidak hadir' && a.metode === 'Otomatis';

// Ganti penanda otomatis menjadi absensi nyata (atomik di dalam transaksi).
// Bila baris sudah diganti request lain yang bersamaan, gagal dengan SUDAH_ABSEN.
const gantiPenanda = async (id, isi, t) => {
  const [n] = await Absensi.update(
    isi, { where: { id, status: 'Tidak hadir', metode: 'Otomatis' }, transaction: t },
  );
  if (!n) throw new HttpError(409, 'Absen masuk hari ini sudah tercatat.', 'SUDAH_ABSEN');
  return Absensi.findByPk(id, { transaction: t });
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

// Dipakai bersama controller face: verifikasi wajah peserta (pulang) harus menunggu
// jendela waktu yang sama dengan scan pembimbing, bukan hanya dicek saat pemindaian.
exports.kisiWaktu = { jadwalHari, cekWaktuPulang };

/* ---------- Peserta ---------- */

// Peserta menayangkan QR dari HP-nya; QR berotasi tiap QR_TTL_DETIK dan satu token
// = milik satu peserta untuk satu jenis absen. Hash disimpan, token mentah hanya lewat
// respons, sehingga QR tiap siswa selalu berbeda satu sama lain. Waktu dan status tetap
// ditentukan server saat pembimbing memindai (lihat scanPeserta).
exports.qrSaya = asyncH(async (req, res) => {
  const jen = jenisOk(req.body.jenis);
  const uid = req.user.id;
  const cfg = await pengaturan.dapatkan();
  if (cfg.metode === 'wajah') {
    throw new HttpError(409, 'Metode absensi saat ini tidak memakai QR. Gunakan verifikasi wajah.', 'MODE_QR_NONAKTIF');
  }
  // qr_wajah: QR hanya boleh dibuat bila verifikasi wajah peserta (jenis sama)
  // masih aktif — belum kedaluwarsa dan belum pernah dipakai. Ditentukan server,
  // bukan dari UI klien, sehingga QR tak mungkin tayang tanpa verifikasi.
  // Baris harian dibagi masuk/pulang (jenis selalu 'masuk'), jadi jangan saring
  // jenis di query. Keputusan sama dengan scanPeserta: masuk ditolak bila baris
  // nyata sudah ada; pulang ditolak hanya bila pulang_jam sudah terisi.
  // Penanda otomatis 'Tidak hadir' boleh ditimpa: QR tayang, penggantian saat pindai.
  const lama = await Absensi.findOne({
    where: {
      user_id: uid, tanggal: bagian().tanggal,
      status: { [Op.notIn]: ['Izin', 'Sakit'] },
    },
  });
  if (lama && !penandaOtomatis(lama) && (jen === 'masuk' || lama.pulang_jam)) {
    throw new HttpError(409, `Absen ${jen} hari ini sudah tercatat.`, 'SUDAH_ABSEN');
  }
  if (cfg.metode === 'qr_wajah') {
    const fV = await FaceVerification.findOne({
      where: { user_id: uid, jenis: jen, dipakai_pada: null },
      order: [['id', 'DESC']],
    });
    if (!fV || new Date(fV.kedaluwarsa_pada).getTime() <= Date.now()) {
      await audit(req, 'QR diminta tanpa verifikasi wajah aktif', `pes#${uid} jenis${jen}`);
      throw new HttpError(
        422,
        'Verifikasi wajah belum dilakukan atau sudah kedaluwarsa. Jalankan verifikasi wajah dahulu, lalu QR baru tayang.',
        'WAJAH_BELUM_VERIF',
      );
    }
  }

  const now = new Date();
  // Lokasi peserta saat menayangkan QR: divalidasi server (Haversine) bila area
  // kantor sudah diatur; bila belum, alur lama — QR tayang tanpa data lokasi.
  const titik = bacaLokasi(req.body);
  const lok = sahkanLokasi(cfg, titik);
  await QrToken.update(
    { kedaluwarsa_pada: now },
    { where: { user_id: uid, jenis: jen, dipakai_pada: null, kedaluwarsa_pada: { [Op.gt]: now } } },
  );
  const mentah = acak();
  const kedaluwarsa = new Date(now.getTime() + env.qrTtl * 1000);
  await QrToken.create({
    token_hash: sha256(mentah), user_id: uid, jenis: jen, kedaluwarsa_pada: kedaluwarsa, ...lok,
  });
  res.status(201).json({ token: mentah, jenis: jen, berlaku_detik: env.qrTtl, kedaluwarsa_pada: kedaluwarsa });
});

// Metode wajah: absensi langsung tanpa QR, setelah embedding cocok dan liveness lolos.
// Server yang menentukan waktu (bagian()), status, dan jenis — klien hanya mengirim embedding.
// Foto (bila ada) tersimpan terenkripsi dan terikat absensi ini untuk koreksi admin.
exports.wajah = asyncH(async (req, res) => {
  const { embedding, jenis, nonce, foto } = req.body;
  const uid = req.user.id;
  const jen = jenisOk(jenis);
  const cfg = await pengaturan.dapatkan();

  // Alur wajah langsung hanya untuk metode global 'wajah'. Bila metode qr/qr_wajah,
  // kedua jenis absen dicatat lewat scan QR peserta oleh pembimbing (lihat scanPeserta).
  if (cfg.metode !== 'wajah') {
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
  const lama = await Absensi.findOne({ where: { user_id: uid, tanggal: w.tanggal } });
  // Satu baris per hari: masuk ditolak bila baris nyata sudah ada; pulang ditolak
  // hanya bila pulang_jam sudah terisi — bukan sekadar karena baris masuk ada.
  if (lama && !penandaOtomatis(lama) && (jen === 'masuk' || lama.pulang_jam)) {
    throw new HttpError(409, `Absen ${jen} hari ini sudah tercatat.`, 'SUDAH_ABSEN');
  }
  if (jen === 'pulang' && (!lama || penandaOtomatis(lama))) {
    // Penanda otomatis tidak dihitung: pulang harus setelah masuk sungguhan
    throw new HttpError(422, 'Anda belum absen masuk hari ini.', 'BELUM_ABSEN_MASUK');
  }

  const jarakWajah = jarak(embedding, dec(tpl.embedding)); // jarak saja yang dicatat, bukan embedding
  if (jarakWajah > env.face.threshold) {
    await audit(req, 'Absensi wajah gagal', jen, { jarak: Number(jarakWajah.toFixed(4)), ambang: env.face.threshold });
    throw new HttpError(422, 'Wajah tidak cocok dengan template yang terdaftar.', 'WAJAH_TIDAK_COCOK');
  }

  // Lokasi absen dari perangkat peserta: divalidasi server bila area kantor diatur
  const lok = sahkanLokasi(cfg, bacaLokasi(req.body));

  const fotoCt = siapkanFoto(foto); // dilempar sebagai 422 bila foto dikirim tapi tidak sah
  const status = hitungStatus(jen, ws, w);
  const isi = { jam: w.jam, status, metode: 'Wajah', ...lok };
  try {
    await sequelize.transaction(async (t) => {
      if (cfg.liveness_aktif) await liveness.periksa(uid, nonce, t);
      // Baris dikunci dan keputusan diperiksa ulang di dalam transaksi agar dua
      // absen bersamaan tidak sama-sama lolos (atomik).
      const baris = lama
        ? await Absensi.findOne({ where: { id: lama.id }, transaction: t, lock: t.LOCK.UPDATE })
        : null;
      let a;
      if (!baris) {
        // Absen pertama hari ini: buat row baru dengan jenis 'masuk'
        a = await Absensi.create({ user_id: uid, tanggal: w.tanggal, jenis: 'masuk', ...isi }, { transaction: t });
      } else if (penandaOtomatis(baris)) {
        if (jen === 'pulang') throw new HttpError(422, 'Anda belum absen masuk hari ini.', 'BELUM_ABSEN_MASUK');
        a = await gantiPenanda(baris.id, isi, t);
      } else if (jen === 'masuk' || baris.pulang_jam) {
        throw new HttpError(409, `Absen ${jen} hari ini sudah tercatat.`, 'SUDAH_ABSEN');
      } else {
        // Pulang: isi kolom pulang pada baris masuk (MySQL tidak butuh returning —
        // baca ulang bila perlu). Guard pulang_jam null mencegah dobel-set bersamaan.
        // Status masuk (mis. Terlambat) dan lokasi masuk tidak ditimpa.
        const [n] = await Absensi.update(
          { pulang_jam: w.jam, pulang_status: status },
          { where: { id: baris.id, pulang_jam: null }, transaction: t },
        );
        if (!n) throw new HttpError(409, 'Absen pulang hari ini sudah tercatat.', 'SUDAH_ABSEN');
        a = await Absensi.findByPk(baris.id, { transaction: t });
      }
      if (fotoCt) await WajahFoto.create({ absensi_id: a.id, data: fotoCt }, { transaction: t });
      // Live tracking: sesi dibuka saat masuk, ditutup saat pulang (transaksi yang sama).
      // Hanya peserta yang sudah memberi persetujuan yang punya sesi.
      if (req.user.setuju_live_tracking) {
        if (jen === 'masuk') await live.bukaSesi(uid, w.tanggal, t);
        else await live.tutupSesi(uid, 'pulang', t);
      }
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

// Metode qr/qr_wajah: pembimbing memindai QR yang ditayangkan peserta. Waktu, status,
// jenis, dan siapa yang memindai ditentukan server dari momen ini — bukan dari HP klien.
// Untuk metode qr_wajah, absensi hanya tercatat bila peserta telah memverifikasi wajah
// sendiri dari HP-nya (/face/verify, masih berlaku dan belum dipakai); foto wajah yang
// dilampirkan saat verifikasi ikut dipindahkan ke absensi (terenkripsi, admin saja yang membaca).
exports.scanPeserta = asyncH(async (req, res) => {
  const { token } = req.body;
  const cfg = await pengaturan.dapatkan();

  if (cfg.metode === 'wajah') {
    throw new HttpError(409, 'Metode absensi saat ini tidak memakai QR. Gunakan verifikasi wajah.', 'MODE_QR_NONAKTIF');
  }

  const tidakValid = () => new HttpError(404, 'Kode ini bukan QR absensi Astakira Media.', 'QR_TIDAK_VALID');
  if (typeof token !== 'string' || token.length < 10 || token.length > 100) throw tidakValid();
  const tok = await QrToken.findOne({
    where: { token_hash: sha256(token) },
    include: [{ model: User, as: 'peserta' }],
  });
  if (!tok) throw tidakValid();
  if (tok.dipakai_pada) throw new HttpError(409, 'QR ini sudah dipakai. Minta peserta menayangkan QR baru.', 'QR_SUDAH_DIPAKAI');
  if (new Date(tok.kedaluwarsa_pada).getTime() <= Date.now()) {
    throw new HttpError(410, 'QR kedaluwarsa. Minta peserta menayangkan QR baru.', 'QR_KEDALUWARSA');
  }
  const uid = tok.user_id;
  // Token hanya dibuat endpoint milik peserta, tetap dipastikan akun pemilik aktif.
  if (!tok.peserta || !tok.peserta.aktif || tok.peserta.role !== 'peserta') throw tidakValid();
  // Jenis absen mengikuti token milik peserta, bukan dikirim klien.
  const jen = tok.jenis;
  const nama = tok.peserta.nama;

  const w = bagian();
  // Cek hari tercatat lebih dulu: peserta yang hari tertulis Izin/Sakit harus
  // menerima HARI_TERCATAT, bukan penjelasan teknis HARI_LIBUR.
  await cekTerkunci(uid, w.tanggal);
  const ws = await jadwalHari(w.hari);
  cekWaktuPulang(jen, ws, w);
  const lama = await Absensi.findOne({ where: { user_id: uid, tanggal: w.tanggal } });
  // Satu baris per hari: masuk ditolak bila baris nyata sudah ada; pulang ditolak
  // hanya bila pulang_jam sudah terisi — bukan sekadar karena baris masuk ada.
  if (lama && !penandaOtomatis(lama) && (jen === 'masuk' || lama.pulang_jam)) {
    throw new HttpError(409, `Peserta ini sudah absen ${jen} hari ini.`, 'SUDAH_ABSEN');
  }
  if (jen === 'pulang' && (!lama || penandaOtomatis(lama))) {
    // Penanda otomatis tidak dihitung: pulang harus setelah masuk sungguhan
    throw new HttpError(422, 'Peserta belum absen masuk hari ini.', 'BELUM_ABSEN_MASUK');
  }

  // qr_wajah: verifikasi wajah dilakukan peserta di HP-nya sendiri sebelum QR tayang.
  // Server hanya menerima baris verifikasi terbaru peserta (belum dipakai dan belum kedaluwarsa).
  let fV = null;
  if (cfg.metode === 'qr_wajah') {
    fV = await FaceVerification.findOne({
      where: { user_id: uid, jenis: jen, dipakai_pada: null },
      order: [['id', 'DESC']],
    });
    if (!fV || new Date(fV.kedaluwarsa_pada).getTime() <= Date.now()) {
      await audit(req, 'Absensi scan tanpa verifikasi wajah aktif', `pes#${uid} jenis${jen}`);
      throw new HttpError(
        422,
        'Peserta belum memverifikasi wajah di HP-nya (atau verifikasi sudah kedaluwarsa). Minta peserta verifikasi wajah dulu, lalu scan ulang QR.',
        'WAJAH_BELUM_VERIF',
      );
    }
  }

  // Lokasi absen milik peserta: dikumpulkan saat peserta menayangkan QR lalu
  // divalidasi ulang di sini (server, dengan radius kantor terkini). QR tanpa
  // lokasi ditolak bila area kantor sudah diatur — minta peserta tayang ulang.
  let lok = {};
  if (cfg.lat_kantor !== null && cfg.lat_kantor !== undefined &&
      cfg.lng_kantor !== null && cfg.lng_kantor !== undefined) {
    if (tok.lat === null || tok.lat === undefined) {
      throw new HttpError(
        422,
        'Peserta menayangkan QR tanpa data lokasi. Minta peserta menayangkan ulang QR dengan izin lokasi aktif.',
        'LOKASI_DIBUTUHKAN',
      );
    }
    lok = sahkanLokasi(cfg, { lat: tok.lat, lng: tok.lng, akurasi_m: tok.akurasi_m }, 'peserta');
  }

  const status = hitungStatus(jen, ws, w);
  const metode = cfg.metode === 'qr_wajah' ? 'QR+Wajah' : 'QR';
  try {
    await sequelize.transaction(async (t) => {
      const [n] = await QrToken.update(
        { dipakai_pada: new Date(), dipindai_oleh: req.user.id, dipindai_pada: new Date() },
        { where: { id: tok.id, dipakai_pada: null }, transaction: t },
      );
      if (!n) throw new HttpError(409, 'QR ini sudah dipakai. Minta peserta menayangkan QR baru.', 'QR_SUDAH_DIPAKAI'); // dua scan bersamaan
      const isi = {
        user_id: uid, tanggal: w.tanggal, jenis: 'masuk', jam: w.jam, status,
        metode, token_id: tok.id, dikonfirmasi_oleh: req.user.id, ...lok,
      };
      // Baris dikunci dan keputusan diperiksa ulang di dalam transaksi agar dua
      // scan bersamaan tidak sama-sama lolos (atomik).
      const baris = lama
        ? await Absensi.findOne({ where: { id: lama.id }, transaction: t, lock: t.LOCK.UPDATE })
        : null;
      let a;
      if (!baris) {
        // Absen pertama hari ini: buat row baru dengan jenis 'masuk'
        a = await Absensi.create(isi, { transaction: t });
      } else if (penandaOtomatis(baris)) {
        if (jen === 'pulang') throw new HttpError(422, 'Peserta belum absen masuk hari ini.', 'BELUM_ABSEN_MASUK');
        a = await gantiPenanda(baris.id, isi, t);
      } else if (jen === 'masuk' || baris.pulang_jam) {
        throw new HttpError(409, `Peserta ini sudah absen ${jen} hari ini.`, 'SUDAH_ABSEN');
      } else {
        // Pulang: isi kolom pulang pada baris masuk. Guard pulang_jam null mencegah
        // dobel-set bersamaan; status masuk (mis. Terlambat) tidak ditimpa.
        const [p] = await Absensi.update(
          { pulang_jam: w.jam, pulang_status: status },
          { where: { id: baris.id, pulang_jam: null }, transaction: t },
        );
        if (!p) throw new HttpError(409, 'Peserta ini sudah absen pulang hari ini.', 'SUDAH_ABSEN');
        a = await Absensi.findByPk(baris.id, { transaction: t });
      }
      // Konsumsi verifikasi wajah (atomik) lalu pindahkan foto ke absensi bila ada
      if (fV) {
        const [m] = await FaceVerification.update(
          { dipakai_pada: new Date(), foto_ciphertext: null },
          { where: { id: fV.id, dipakai_pada: null }, transaction: t },
        );
        if (!m) {
          // Verifikasi dipakai pindaian lain yang bersamaan
          throw new HttpError(
            422,
            'Peserta belum memverifikasi wajah di HP-nya (atau verifikasi sudah kedaluwarsa). Minta peserta verifikasi wajah dulu, lalu scan ulang QR.',
            'WAJAH_BELUM_VERIF',
          );
        }
        if (fV.foto_ciphertext) {
          await WajahFoto.create({ absensi_id: a.id, data: fV.foto_ciphertext }, { transaction: t });
        }
      }
      // Live tracking (data peserta dari token, bukan pembimbing pemindai):
      // sesi dibuka saat masuk, ditutup saat pulang — dalam transaksi absensi.
      if (tok.peserta.setuju_live_tracking) {
        if (jen === 'masuk') await live.bukaSesi(uid, w.tanggal, t);
        else await live.tutupSesi(uid, 'pulang', t);
      }
    });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, `Peserta ini sudah absen ${jen} hari ini.`, 'SUDAH_ABSEN');
    }
    if (e instanceof HttpError) throw e;
    // Kirim error 422 dengan detail error agar tidak jadi 500 server error
    throw new HttpError(422, e.message || 'Gagal catat absensi', e.kode || 'SERVER_ERROR');
  }
  await audit(req, `Absensi scan peserta ${jen}`, `${status} | pes#${uid} | oleh#${req.user.id}`,
    fV ? 'verifikasi wajah dari HP peserta' : null);
  res.json({ pesan: 'Absensi tercatat.', nama, jam: w.jam, status, metode });
});

exports.riwayat = asyncH(async (req, res) => {
  const where = { user_id: req.user.id };
  const r = rentang(req.query);
  if (r) where.tanggal = r;
  const data = await Absensi.findAll({
    where, order: [['tanggal', 'DESC'], ['jenis', 'ASC']], limit: 366,
    attributes: ['id', 'tanggal', 'jenis', 'jam', 'pulang_jam', 'pulang_status', 'status', 'metode', 'keterangan',
      'lat', 'lng', 'jarak_m', 'di_dalam_area'],
  });
  res.json({ data });
});

