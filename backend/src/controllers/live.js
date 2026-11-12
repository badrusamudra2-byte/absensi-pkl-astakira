const { Op } = require('sequelize');
const {
  sequelize, SesiTracking, User, Peserta, Absensi, Workshift,
} = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');
const { bagian, menitDariJam } = require('../utils/waktu');
const { bacaLokasi } = require('../utils/lokasi');
const audit = require('../utils/audit');

/* Live tracking (tahap 2): sesi aktif antara absen masuk dan absen pulang.
 * Posisi terakhir saja yang disimpan (upsert baris sesi), server menentukan
 * sesi mana yang boleh menerima posisi — bukan frontend. */

// Ambang "Terputus" di peta: tanpa pembaruan lebih dari ini dianggap terputus.
// Interval kirim posisi frontend ±45 detik; ambang 2 menit memberi ruang aman.
const PUTUS_SEKON = 120;

const sesiAktif = (uid) => SesiTracking.findOne({ where: { user_id: uid, status: 'aktif' } });

/** Buka sesi (dipakai saat absen masuk / saat persetujuan pertama di tengah hari). */
exports.bukaSesi = async (uid, tanggal, t) => {
  const ada = await SesiTracking.findOne({ where: { user_id: uid, status: 'aktif' }, transaction: t });
  if (ada) return null; // sudah aktif — idempotent
  return SesiTracking.create(
    { user_id: uid, tanggal, status: 'aktif', mulai_pada: new Date() },
    { transaction: t },
  );
};

/** Tutup sesi aktif dan kosongkan posisi terakhir (dipakai pulang & job otomatis). */
exports.tutupSesi = async (uid, sebab, t) => {
  const [n] = await SesiTracking.update(
    {
      status: 'selesai', ditutup_pada: new Date(), sebab,
      lat: null, lng: null, akurasi_m: null, diperbarui_pada: null,
    },
    { where: { user_id: uid, status: 'aktif' }, transaction: t },
  );
  return n > 0;
};

/* ---------- Peserta ---------- */

// Persetujuan pelacakan pertama (banner frontend). Bila hari kerja dan peserta
// sudah absen masuk (belum pulang), sesi langsung dibuka agar izin di tengah
// hari tetap berlaku — sesi tetap dibuat server, bukan klien.
exports.izin = asyncH(async (req, res) => {
  const uid = req.user.id;
  if (!req.user.setuju_live_tracking) {
    await req.user.update({ setuju_live_tracking: true });
    await audit(req, 'Setuju live tracking', `pes#${uid}`);
  }
  const w = bagian();
  let sesi = await sesiAktif(uid);
  if (!sesi) {
    const ws = await Workshift.findOne({ where: { hari: w.hari } });
    const masuk = await Absensi.findOne({
      where: { user_id: uid, tanggal: w.tanggal, jenis: 'masuk', status: { [Op.notIn]: ['Izin', 'Sakit'] } },
    });
    // Hanya bila hari kerja, sudah absen masuk sungguhan, dan belum lewat jam pulang
    if (ws && ws.hari_kerja && masuk && w.menit < menitDariJam(ws.jam_pulang)) {
      sesi = await sequelize.transaction((t) => exports.bukaSesi(uid, w.tanggal, t));
    }
  }
  res.json({
    pesan: 'Persetujuan live tracking tercatat.',
    setuju: true,
    sesi: sesi ? { mulai_pada: sesi.mulai_pada, tanggal: sesi.tanggal } : null,
  });
});

// Status untuk banner/pengirim frontend: apakah sudah setuju dan sesi aktif.
exports.status = asyncH(async (req, res) => {
  const sesi = await sesiAktif(req.user.id);
  res.json({
    setuju: !!req.user.setuju_live_tracking,
    sesi: sesi ? { mulai_pada: sesi.mulai_pada, tanggal: sesi.tanggal } : null,
  });
});

// Kirim posisi berkala. Server yang memutuskan sesi mana yang valid:
// tanpa sesi aktif (belum masuk / sudah pulang / sudah ditutup) posisi ditolak.
exports.posisi = asyncH(async (req, res) => {
  const uid = req.user.id;
  if (!req.user.setuju_live_tracking) {
    throw new HttpError(403, 'Persetujuan live tracking belum diberikan.', 'LIVE_BELUM_SETUJU');
  }
  const titik = bacaLokasi(req.body);
  if (!titik) {
    throw new HttpError(400, 'Posisi tidak dikirim. Aktifkan izin lokasi perangkat.', 'VALIDASI');
  }
  const sesi = await sesiAktif(uid);
  if (!sesi) {
    throw new HttpError(
      409,
      'Tidak ada sesi pelacakan aktif — pelacakan hanya berjalan dari absen masuk sampai absen pulang.',
      'LIVE_TIDAK_AKTIF',
    );
  }
  await SesiTracking.update(
    { lat: titik.lat, lng: titik.lng, akurasi_m: titik.akurasi_m, diperbarui_pada: new Date() },
    { where: { id: sesi.id, status: 'aktif' } }, // upsert aman: sesi bisa saja baru ditutup
  );
  res.json({ pesan: 'Posisi tercatat.' }); // tanpa riwayat: hanya baris ini yang menyimpan posisi
});

/* ---------- Peta live: pembimbing (bimbingannya) dan admin (semua) ---------- */

// Status tiap peserta: Aktif (pembaruan segar), Terputus (sesi aktif tapi posisi lama),
// Selesai (sesi hari ini sudah ditutup — posisi sudah dihapus).
const statusSesi = (s, kini) => {
  if (!s) return { status: 'Selesai' };
  if (!s.diperbarui_pada) return { status: 'Terputus', terakhir: null, menit: null };
  const sekon = Math.round((kini - new Date(s.diperbarui_pada).getTime()) / 1000);
  if (sekon <= PUTUS_SEKON) return { status: 'Aktif', terakhir: s.diperbarui_pada, menit: 0 };
  return { status: 'Terputus', terakhir: s.diperbarui_pada, menit: Math.floor(sekon / 60) };
};

exports.peta = asyncH(async (req, res) => {
  const pembimbing = req.user.role === 'pembimbing';
  // Pembimbing hanya melihat bimbingannya; admin melihat semua peserta aktif.
  const daftar = await User.findAll({
    where: { role: 'peserta', aktif: true },
    attributes: ['id', 'nama', 'foto_url'],
    include: [{ model: Peserta, as: 'peserta', attributes: ['pembimbing_id'] }],
    order: [['nama', 'ASC']],
  });
  const milik = pembimbing
    ? daftar.filter((u) => u.peserta && u.peserta.pembimbing_id === req.user.id)
    : daftar;
  const ids = milik.map((u) => u.id);

  const aktif = ids.length
    ? await SesiTracking.findAll({ where: { user_id: ids, status: 'aktif' } })
    : [];
  // Sesi hari ini yang sudah selesai (tampil sebagai "Selesai", tanpa posisi)
  const hari = bagian().tanggal;
  const selesai = ids.length
    ? await SesiTracking.findAll({
      where: { user_id: ids, tanggal: hari, status: 'selesai' },
      attributes: ['user_id', 'status', 'sebab'],
    })
    : [];

  const kini = Date.now();
  const data = milik.map((u) => {
    const s = aktif.find((x) => x.user_id === u.id);
    // Sesi aktif: Aktif/Terputus; tanpa sesi aktif: Selesai (termasuk belum absen masuk)
    const st = s ? statusSesi(s, kini) : { status: 'Selesai' };
    return {
      user_id: u.id,
      nama: u.nama,
      foto_url: u.foto_url,
      status: st.status,
      // Titik hanya dikirim untuk pembimbing/admin yang berhak, dan bila sesi aktif
      lat: s ? s.lat : null,
      lng: s ? s.lng : null,
      akurasi_m: s ? s.akurasi_m : null,
      diperbarui_pada: st.terakhir ?? null,
      menit_lalu: st.menit,
      sebab: s ? null : (selesai.find((x) => x.user_id === u.id)?.sebab ?? null),
    };
  });

  // Setiap akses peta live masuk audit log (wajib tahap 2)
  await audit(req, 'Lihat peta live', `oleh#${req.user.id} (${req.user.role})`, { jumlah: data.length });
  res.json({ data });
});
