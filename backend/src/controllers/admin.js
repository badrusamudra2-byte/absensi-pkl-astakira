const bcrypt = require('bcryptjs');
const { Op, fn } = require('sequelize');
const {
  sequelize, User, Peserta, Pembimbing, Workshift, FaceTemplate, FaceVerification, TantanganWajah,
  QrToken, AbsensiPenolakan, Absensi, WajahFoto, Jurnal, AuditLog,
} = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');
const { wajib, jam, email, kuat } = require('../utils/validasi');
const { acak, dekripBait } = require('../utils/crypto');
const { HARI, bagian, rentang } = require('../utils/waktu');
const mail = require('../utils/mailer');
const csv = require('../utils/csv');
const audit = require('../utils/audit');

/* ---------- CRUD peserta dan pembimbing (satu pabrik untuk keduanya) ---------- */
function crud(role, Profile, alias) {
  const include = role === 'peserta'
    ? [{ model: Profile, as: alias, include: [{ model: User, as: 'pembimbing', attributes: ['id', 'nama'] }] }]
    : [{ model: Profile, as: alias }];

  const dataProfil = async (b) => {
    const o = {};
    if (b.divisi !== undefined) o.divisi = String(b.divisi).trim().slice(0, 80);
    if (role === 'peserta' && b.pembimbing_id) {
      const p = await User.findOne({ where: { id: b.pembimbing_id, role: 'pembimbing', aktif: true } });
      if (!p) throw new HttpError(400, 'Pembimbing tidak ditemukan atau nonaktif.', 'VALIDASI');
      o.pembimbing_id = p.id;
    }
    return o;
  };
  const cari = async (id) => {
    const u = await User.findOne({ where: { id, role } });
    if (!u) throw new HttpError(404, 'Data tidak ditemukan.', 'TIDAK_ADA');
    return u;
  };

  return {
    list: asyncH(async (req, res) => {
      res.json({ data: await User.findAll({ where: { role }, include, order: [['nama', 'ASC']] }) });
    }),

    detail: asyncH(async (req, res) => {
      const u = await User.findOne({ where: { id: req.params.id, role }, include });
      if (!u) throw new HttpError(404, 'Data tidak ditemukan.', 'TIDAK_ADA');
      res.json(u);
    }),

    create: asyncH(async (req, res) => {
      const b = req.body;
      const nama = wajib(b.nama, 100);
      const mail_ = email(b.email);
      const username = String(b.username || mail_.split('@')[0]).trim().toLowerCase().slice(0, 50);
      // Kata sandi awal boleh ditentukan admin (umum: email buatan, tanpa kotak masuk sungguhan).
      // Plain text tidak pernah disimpan maupun diulang di respons — hanya hash di database.
      const adminIsiSandi = b.password !== undefined && b.password !== null && String(b.password) !== '';
      if (adminIsiSandi && !kuat(b.password)) {
        throw new HttpError(400, 'Kata sandi awal minimal 8 karakter (maksimal 72).', 'VALIDASI');
      }
      const sementara = adminIsiSandi ? b.password : acak(9);
      const profil = await dataProfil(b);
      const u = await sequelize.transaction(async (t) => {
        const baru = await User.create(
          { nama, email: mail_, username, role, password_hash: await bcrypt.hash(sementara, 12) }, { transaction: t },
        );
        await Profile.create({ user_id: baru.id, ...profil }, { transaction: t });
        return baru;
      });
      await mail
        .kirim({
          to: mail_,
          subject: 'Akun Panel Absensi PKL Astakira Media',
          text: `Halo ${nama},\n\nAkun Anda sudah dibuat.\nEmail: ${mail_}\nKata sandi sementara: ${sementara}\n\nSegera ganti kata sandi setelah login pertama.`,
        })
        .catch((e) => console.error('Email gagal dikirim:', e.message));
      await audit(req, `Tambah ${role}`, nama);
      res.status(201).json({ id: u.id, nama, email: mail_, username });
    }),

    update: asyncH(async (req, res) => {
      const u = await cari(req.params.id);
      const b = req.body;
      const f = {};
      if (b.nama !== undefined) f.nama = wajib(b.nama, 100);
      if (b.email !== undefined) f.email = email(b.email);
      if (b.aktif !== undefined) f.aktif = Boolean(b.aktif);
      const profil = await dataProfil(b);
      await sequelize.transaction(async (t) => {
        await u.update(f, { transaction: t });
        if (Object.keys(profil).length) await Profile.update(profil, { where: { user_id: u.id }, transaction: t });
        // Akun dinonaktifkan: template dan verifikasi wajah dihapus agar
        // akun yang kembali aktif harus mendaftar wajah ulang (biometrik selalu terkini).
        if (b.aktif === false) {
          const w = { where: { user_id: u.id }, transaction: t };
          await FaceTemplate.destroy(w);
          await FaceVerification.destroy(w);
          await TantanganWajah.destroy(w);
          // QR token memakai user_id untuk kedua peran; diangkat agar
          // pemindai ulang tidak bisa memakai token lama peserta/pembimbing nonaktif
          await QrToken.destroy(w);
        }
      });
      await audit(req, `Ubah ${role}`, u.nama);
      res.json({ pesan: 'Data disimpan.' });
    }),

    remove: asyncH(async (req, res) => {
      const u = await cari(req.params.id);
      const pakai = (await Absensi.count({ where: { user_id: u.id } }))
        + (await Jurnal.count({ where: { user_id: u.id } }))
        + (role === 'pembimbing' ? await Peserta.count({ where: { pembimbing_id: u.id } }) : 0);
      if (pakai) {
        throw new HttpError(409, 'Data ini sudah punya riwayat atau peserta terkait. Nonaktifkan saja agar riwayat tetap utuh.', 'PUNYA_RIWAYAT');
      }
      await sequelize.transaction(async (t) => {
        const w = { where: { user_id: u.id }, transaction: t };
        await QrToken.destroy(w);
        await FaceVerification.destroy(w);
        await FaceTemplate.destroy(w);
        await AbsensiPenolakan.destroy(w);
        await Profile.destroy(w);
        await u.destroy({ transaction: t });
      });
      await audit(req, `Hapus ${role}`, u.nama);
      res.json({ pesan: 'Data dihapus.' });
    }),
  };
}
exports.peserta = crud('peserta', Peserta, 'peserta');
exports.pembimbing = crud('pembimbing', Pembimbing, 'pembimbing_profil');

/* ---------- Workshift ---------- */
exports.wsList = asyncH(async (req, res) => {
  res.json({ data: await Workshift.findAll({ order: [['id', 'ASC']] }) });
});

exports.wsSimpan = asyncH(async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items) || items.length !== 7) throw new HttpError(400, 'Kirim 7 hari (Senin sampai Minggu).', 'VALIDASI');
  const baris = items.map((i) => {
    if (!HARI.includes(i.hari)) throw new HttpError(400, 'Nama hari tidak valid.', 'VALIDASI');
    const m = jam(i.jam_masuk), p = jam(i.jam_pulang), tol = Number(i.toleransi_menit);
    if (!m || !p || !Number.isInteger(tol) || tol < 0 || tol > 120) {
      throw new HttpError(400, `Jadwal ${i.hari} tidak valid (cek format jam dan toleransi 0-120 menit).`, 'VALIDASI');
    }
    if (i.hari_kerja && p <= m) throw new HttpError(400, `Jam pulang ${i.hari} harus setelah jam masuk.`, 'VALIDASI');
    return { hari: i.hari, hari_kerja: Boolean(i.hari_kerja), jam_masuk: m, jam_pulang: p, toleransi_menit: tol };
  });
  if (new Set(baris.map((b) => b.hari)).size !== 7) throw new HttpError(400, 'Setiap hari harus muncul satu kali.', 'VALIDASI');
  await Workshift.bulkCreate(baris, { updateOnDuplicate: ['hari_kerja', 'jam_masuk', 'jam_pulang', 'toleransi_menit', 'diubah_pada'] });
  await audit(req, 'Ubah jadwal workshift');
  res.json({ pesan: 'Jadwal disimpan.' });
});

/* ---------- Ringkasan, laporan, audit ---------- */
exports.ringkasan = asyncH(async (req, res) => {
  const w = bagian();
  const hariIni = (status) => Absensi.count({ where: { tanggal: w.tanggal, jenis: 'masuk', status } });
  const [peserta, pembimbing, tepat, terlambat] = await Promise.all([
    User.count({ where: { role: 'peserta', aktif: true } }),
    User.count({ where: { role: 'pembimbing', aktif: true } }),
    hariIni('Hadir'),
    hariIni('Terlambat'),
  ]);
  const dari = bagian(new Date(Date.now() - 6 * 864e5)).tanggal;
  const grafik = await Absensi.findAll({
    attributes: ['tanggal', 'status', [fn('COUNT', '*'), 'n']],
    where: { jenis: 'masuk', tanggal: { [Op.gte]: dari }, status: { [Op.in]: ['Hadir', 'Terlambat'] } },
    group: ['tanggal', 'status'], order: [['tanggal', 'ASC']], raw: true,
  });
  res.json({
    peserta_aktif: peserta, pembimbing_aktif: pembimbing,
    hadir_hari_ini: tepat + terlambat, terlambat_hari_ini: terlambat, grafik,
  });
});

exports.laporan = asyncH(async (req, res) => {
  const r = rentang(req.query);
  const rows = await Absensi.findAll({
    where: r ? { tanggal: r } : {}, order: [['tanggal', 'DESC'], ['jam', 'ASC']], limit: 5000,
    include: [{ model: User, as: 'peserta', attributes: ['nama'] }],
  });
  if (req.query.format === 'csv') {
    await audit(req, 'Export laporan CSV');
    return res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="laporan-absensi.csv"')
      .send(csv(['Tanggal', 'Peserta', 'Jenis', 'Jam', 'Status', 'Metode'],
        rows.map((a) => [a.tanggal, a.peserta.nama, a.jenis, a.jam, a.status, a.metode])));
  }
  res.json({ data: rows });
});

exports.audit = asyncH(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const halaman = Math.max(parseInt(req.query.halaman, 10) || 1, 1);
  const { rows, count } = await AuditLog.findAndCountAll({ order: [['id', 'DESC']], limit, offset: (halaman - 1) * limit });
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const users = await User.findAll({ where: { id: ids }, attributes: ['id', 'nama'] });
  const nama = Object.fromEntries(users.map((u) => [u.id, u.nama]));
  res.json({ total: count, halaman, data: rows.map((r) => ({ ...r.toJSON(), pengguna: nama[r.user_id] || '-' })) });
});

exports.resetWajah = asyncH(async (req, res) => {
  const n = await FaceTemplate.destroy({ where: { user_id: req.params.id } });
  if (!n) throw new HttpError(404, 'Peserta belum punya template wajah.', 'TIDAK_ADA');
  await audit(req, 'Reset template wajah', `user#${req.params.id}`);
  res.json({ pesan: 'Template wajah dihapus. Peserta bisa mendaftar ulang.' });
});

/* ---------- Absensi: lihat per tanggal, koreksi ---------- */

const STATUS_KOREKSI = ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Tidak hadir'];

// Daftar semua baris absensi satu peserta pada satu tanggal (untuk form koreksi)
exports.absensiPerTanggal = asyncH(async (req, res) => {
  const uid = Number(req.query.user_id);
  const tanggal = String(req.query.tanggal || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    throw new HttpError(400, 'Tanggal harus berformat YYYY-MM-DD.', 'VALIDASI');
  }
  const p = await User.findOne({ where: { id: uid, role: 'peserta' }, attributes: ['id', 'nama'] });
  if (!p) throw new HttpError(404, 'Peserta tidak ditemukan.', 'TIDAK_ADA');
  const data = await Absensi.findAll({ where: { user_id: uid, tanggal }, order: [['jenis', 'ASC']] });
  res.json({ peserta: p, data });
});

// Foto wajah satu baris absensi (terenkripsi di penyimpanan; diuraikan hanya bila admin
// membukanya, lalu diberikan sebagai JPEG ke browser). Dicatat di audit log.
exports.fotoWajah = asyncH(async (req, res) => {
  const a = await Absensi.findByPk(req.params.id);
  if (!a) throw new HttpError(404, 'Baris absensi tidak ditemukan.', 'TIDAK_ADA');
  const f = await WajahFoto.findOne({ where: { absensi_id: a.id } });
  if (!f) {
    throw new HttpError(404, 'Absensi ini tidak punya foto wajah (mis. metode QR tanpa wajah).', 'FOTO_ABSEN_TAK_ADA');
  }
  await audit(req, 'Buka foto absensi', `absensi#${a.id} pes#${a.user_id}`);
  res.type('image/jpeg').send(dekripBait(f.data));
});

// Koreksi absensi oleh admin: alasan wajib, nilai lama dan baru dicatat di audit
exports.koreksi = asyncH(async (req, res) => {
  const a = await Absensi.findByPk(req.params.id);
  if (!a) throw new HttpError(404, 'Baris absensi tidak ditemukan.', 'TIDAK_ADA');
  const alasan = String(req.body.alasan || '').trim();
  if (alasan.length < 3) throw new HttpError(400, 'Tulis alasan koreksi (minimal 3 karakter).', 'ALASAN_WAJIB');

  const f = {};
  if (req.body.jam !== undefined) {
    const j = jam(req.body.jam);
    if (!j) throw new HttpError(400, 'Jam harus berformat HH:MM atau HH:MM:SS.', 'VALIDASI');
    f.jam = j;
  }
  if (req.body.status !== undefined) {
    const st = String(req.body.status).trim();
    if (!STATUS_KOREKSI.includes(st)) {
      throw new HttpError(400, `Status harus salah satu dari: ${STATUS_KOREKSI.join(', ')}.`, 'VALIDASI');
    }
    f.status = st;
  }
  const jenisBaru = req.body.jenis !== undefined;
  if (jenisBaru) {
    if (!['masuk', 'pulang'].includes(String(req.body.jenis))) {
      throw new HttpError(400, 'Jenis absen harus masuk atau pulang.', 'VALIDASI');
    }
    f.jenis = String(req.body.jenis);
  }
  if (!Object.keys(f).length) {
    throw new HttpError(400, 'Tidak ada perubahan yang dikirim (cek kolom jenis/jam/status).', 'VALIDASI');
  }
  if (f.jenis && f.jenis !== a.jenis) {
    const bentrok = await Absensi.findOne({
      where: { user_id: a.user_id, tanggal: a.tanggal, jenis: f.jenis },
    });
    if (bentrok && bentrok.id !== a.id) {
      throw new HttpError(409, `Absen ${f.jenis} tanggal tersebut sudah ada.`, 'SUDAH_ABSEN');
    }
  }

  const lama = { jenis: a.jenis, jam: a.jam, status: a.status, metode: a.metode };
  await a.update(f);
  const baru = { jenis: a.jenis, jam: a.jam, status: a.status, metode: a.metode };
  await audit(req, 'Koreksi absensi', `absensi#${a.id}`, { lama, baru, alasan: alasan.slice(0, 500) });
  res.json({ pesan: 'Absensi dikoreksi.', data: a });
});
