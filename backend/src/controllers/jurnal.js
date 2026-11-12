const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { Jurnal, JurnalReview, User, Absensi, Peserta } = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');
const { bagian } = require('../utils/waktu');
const audit = require('../utils/audit');

const DIR_LAMPIRAN = path.join(__dirname, '../../uploads/lampiran');

const STATUS = ['Draft', 'Dikirim', 'Revisi', 'Disetujui'];

const ambil = (b) => {
  const o = {};
  for (const k of ['judul', 'uraian', 'hasil', 'kendala', 'rencana']) o[k] = String(b[k] ?? '').trim();
  if (!o.judul || !o.uraian) throw new HttpError(400, 'Judul dan uraian kegiatan wajib diisi.', 'VALIDASI');
  if (o.judul.length > 150) throw new HttpError(400, 'Judul maksimal 150 karakter.', 'VALIDASI');
  for (const k of ['uraian', 'hasil', 'kendala', 'rencana']) {
    if (o[k].length > 5000) throw new HttpError(400, `Isi ${k} terlalu panjang (maksimal 5000 karakter).`, 'VALIDASI');
  }
  return o;
};

/** Tanggal YYYY-MM-DD: kalender sah dan tidak boleh masa depan. Batas mundur lepas:
 * jurnal mengikuti kehadiran — tanggal ber-absensi tetap boleh diisi kapan pun. */
const tanggalOk = (b) => {
  const s = String(b.tanggal ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new HttpError(400, 'Tanggal harus berformat YYYY-MM-DD.', 'VALIDASI');
  }
  const [y, m, h] = s.split('-').map(Number);
  const sah = m >= 1 && m <= 12 && h >= 1 && h <= 31
    && new Date(Date.UTC(y, m - 1, h)).toISOString().slice(0, 10) === s;
  if (!sah) {
    throw new HttpError(400, 'Tanggal tidak valid.', 'VALIDASI');
  }
  const kini = new Date(`${bagian().tanggal}T00:00:00Z`);
  const hari = new Date(Date.UTC(y, m - 1, h));
  if (hari > kini) {
    throw new HttpError(400, 'Tanggal jurnal tidak boleh di masa depan.', 'VALIDASI');
  }
  return s;
};

/** Jurnal baru hanya untuk tanggal yang punya absen masuk nyata (Hadir/Terlambat) —
 * peserta yang tidak masuk (izin/sakit/tidak hadir) tidak bisa membuat jurnal.
 * Jurnal lama yang tanggalnya tak punya absensi tetap boleh diedit tanpa pindah tanggal. */
const absenAda = async (user_id, tanggal) => {
  const a = await Absensi.findOne({
    where: { user_id, tanggal, jenis: 'masuk', status: { [Op.in]: ['Hadir', 'Terlambat'] } },
    attributes: ['id'],
  });
  if (!a) {
    throw new HttpError(422, 'Jurnal hanya bisa ditulis untuk tanggal Anda absen masuk.', 'JURNAL_BUTUH_ABSEN');
  }
};

const milik = async (req) => {
  const j = await Jurnal.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!j) throw new HttpError(404, 'Jurnal tidak ditemukan.', 'TIDAK_ADA');
  return j;
};

// Konflik batas unik (uq_jurnal_harian) -> 409 dengan pesan jelas
const bentrok = (e) => {
  if (e.name === 'SequelizeUniqueConstraintError') {
    throw new HttpError(409, 'Anda sudah punya jurnal untuk tanggal ini.', 'JURNAL_ADA');
  }
  throw e;
};

/* ---------- Lampiran foto kegiatan (opsional) ---------- */

const hapusBerkas = (nama) => {
  if (!nama || !/^[0-9a-f]{32}\.(jpe?g|png|webp)$/i.test(nama)) return;
  try { fs.unlinkSync(path.join(DIR_LAMPIRAN, nama)); } catch { /* berkas sudah tidak ada */ }
};

// Siapa boleh melihat lampiran: pemilik, pembimbing yang membimbing, atau admin
const bolehLihat = async (j, user) => {
  if (user.id === j.user_id || user.role === 'admin') return true;
  if (user.role !== 'pembimbing') return false;
  const p = await Peserta.findOne({ where: { user_id: j.user_id }, attributes: ['pembimbing_id'] });
  return !!p && p.pembimbing_id === user.id;
};

// Unggah/ubah/hapus: hanya jurnal Draft/Revisi (status lain tidak boleh diubah).
// Tanpa berkas di body = hapus lampiran. Berkas lama dibersihkan.
exports.isiLampiran = asyncH(async (req, res) => {
  const j = await milik(req);
  if (!['Draft', 'Revisi'].includes(j.status)) {
    hapusBerkas(req.file?.filename); // jangan tinggalkan berkas yatim
    throw new HttpError(409, `Jurnal berstatus ${j.status} tidak bisa diubah.`, 'STATUS_TIDAK_VALID');
  }
  const lama = j.lampiran;
  const baru = req.file ? req.file.filename : null;
  try {
    await j.update({ lampiran: baru });
  } catch (e) {
    hapusBerkas(baru);
    throw e;
  }
  if (lama && lama !== baru) hapusBerkas(lama);
  await audit(req, baru ? 'Unggah lampiran jurnal' : 'Hapus lampiran jurnal', `jurnal#${j.id}`);
  res.json({
    pesan: baru ? 'Lampiran kegiatan disimpan.' : 'Lampiran kegiatan dihapus.',
    lampiran: j.lampiran,
  });
});

exports.lampiran = asyncH(async (req, res) => {
  const j = await Jurnal.findByPk(req.params.id, { attributes: ['id', 'user_id', 'lampiran'] });
  if (!j || !j.lampiran) throw new HttpError(404, 'Lampiran jurnal tidak ditemukan.', 'TIDAK_ADA');
  if (!(await bolehLihat(j, req.user))) {
    throw new HttpError(403, 'Lampiran ini bukan jurnal Anda atau bimbingan Anda.', 'DILARANG');
  }
  await audit(req, 'Buka lampiran jurnal', `jurnal#${j.id}`);
  res.sendFile(path.join(DIR_LAMPIRAN, j.lampiran));
});

exports.list = asyncH(async (req, res) => {
  // Daftar dibentuk dari tanggal absen masuk milik peserta (dulu, hari itu "ada"),
  // digabung jurnal yang sudah ditulis. Tanpa filter status, tanggal ber-absensi
  // tanpa jurnal ikut tampil — peserta langsung melihat mana yang belum diisi.
  const status = STATUS.includes(req.query.status) ? req.query.status : null;
  const a = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.dari ?? '')) ? req.query.dari : null;
  const b = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.sampai ?? '')) ? req.query.sampai : null;
  const rentang = () => {
    if (a && b) return { [Op.between]: [a, b] };
    if (a) return { [Op.gte]: a };
    if (b) return { [Op.lte]: b };
    return undefined;
  };

  const wa = {
    user_id: req.user.id, jenis: 'masuk',
    status: { [Op.in]: ['Hadir', 'Terlambat'] },
  };
  const r = rentang();
  if (r) wa.tanggal = r;
  const absen = await Absensi.findAll({
    where: wa, order: [['tanggal', 'DESC']],
    attributes: ['tanggal', 'jam', 'status'],
  });

  const wj = { user_id: req.user.id };
  if (status) wj.status = status;
  if (r) wj.tanggal = r;
  const jurnal = await Jurnal.findAll({
    where: wj, order: [['tanggal', 'DESC'], ['id', 'DESC']], limit: 200,
    attributes: ['id', 'tanggal', 'judul', 'status'],
  });

  const baris = new Map(jurnal.map((j) => [j.tanggal, {
    tanggal: j.tanggal, absensi: null, id: j.id, judul: j.judul, status: j.status,
  }]));
  if (!status) {
    for (const x of absen) {
      if (baris.has(x.tanggal)) baris.get(x.tanggal).absensi = { masuk: x.jam, status: x.status };
      else baris.set(x.tanggal, {
        tanggal: x.tanggal, absensi: { masuk: x.jam, status: x.status },
        id: null, judul: null, status: null,
      });
    }
  } else {
    for (const x of absen) {
      if (baris.has(x.tanggal)) baris.get(x.tanggal).absensi = { masuk: x.jam, status: x.status };
    }
  }
  const data = [...baris.values()].sort(
    (p, s) => s.tanggal.localeCompare(p.tanggal) || (s.id ?? 0) - (p.id ?? 0),
  );
  res.json({ data });
});

// body.tanggal dipilih peserta (YYYY-MM-DD); aksi: "kirim" untuk langsung dikirim
exports.create = asyncH(async (req, res) => {
  const tanggal = tanggalOk(req.body);
  await absenAda(req.user.id, tanggal);
  try {
    const j = await Jurnal.create({
      ...ambil(req.body), user_id: req.user.id, tanggal,
      status: req.body.aksi === 'kirim' ? 'Dikirim' : 'Draft',
    });
    res.status(201).json(j);
  } catch (e) {
    bentrok(e);
  }
});

exports.detail = asyncH(async (req, res) => {
  const j = await Jurnal.findOne({
    where: { id: req.params.id, user_id: req.user.id },
    include: [{ model: JurnalReview, as: 'reviews', include: [{ model: User, as: 'pembimbing', attributes: ['id', 'nama'] }] }],
    order: [[{ model: JurnalReview, as: 'reviews' }, 'id', 'ASC']],
  });
  if (!j) throw new HttpError(404, 'Jurnal tidak ditemukan.', 'TIDAK_ADA');
  res.json(j);
});

// Hanya jurnal Draft atau Revisi yang boleh diubah ("Perbaiki dan kirim ulang" saat Revisi)
exports.update = asyncH(async (req, res) => {
  const j = await milik(req);
  if (!['Draft', 'Revisi'].includes(j.status)) {
    throw new HttpError(409, `Jurnal berstatus ${j.status} tidak bisa diubah.`, 'STATUS_TIDAK_VALID');
  }
  const tanggal = tanggalOk(req.body);
  // Pindah tanggal mengikuti aturan yang sama; tanggal lama jurnal lama dikecualikan
  if (tanggal !== j.tanggal) await absenAda(req.user.id, tanggal);
  try {
    await j.update({ ...ambil(req.body), tanggal, status: req.body.aksi === 'kirim' ? 'Dikirim' : j.status });
    res.json(j);
  } catch (e) {
    bentrok(e);
  }
});

// Peserta menarik kembali jurnal yang sudah dikirim (belum direview) menjadi
// Draft agar bisa diedit. Jurnal Disetujui tetap terkunci.
exports.tarik = asyncH(async (req, res) => {
  const j = await milik(req);
  if (j.status !== 'Dikirim') {
    throw new HttpError(409, `Jurnal berstatus ${j.status} tidak bisa ditarik.`, 'STATUS_TIDAK_VALID');
  }
  await j.update({ status: 'Draft' });
  await audit(req, 'Tarik jurnal ke draft', `jurnal#${j.id}`);
  res.json(j);
});
