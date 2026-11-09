const { Op } = require('sequelize');
const { Jurnal, JurnalReview, User } = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');
const { bagian } = require('../utils/waktu');
const env = require('../config/env');

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

/** Tanggal YYYY-MM-DD: kalender sah, tidak boleh masa depan, maksimal maksBuka hari ke belakang. */
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
  const batas = new Date(kini.getTime() - env.jurnal.maksBuka * 86400000);
  if (hari < batas) {
    throw new HttpError(
      400, `Jurnal maksimal untuk ${env.jurnal.maksBuka} hari ke belakang.`, 'VALIDASI',
    );
  }
  return s;
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

exports.list = asyncH(async (req, res) => {
  const where = { user_id: req.user.id };
  if (STATUS.includes(req.query.status)) where.status = req.query.status;
  const a = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.dari ?? '')) ? req.query.dari : null;
  const b = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.sampai ?? '')) ? req.query.sampai : null;
  if (a && b) where.tanggal = { [Op.between]: [a, b] };
  else if (a) where.tanggal = { [Op.gte]: a };
  else if (b) where.tanggal = { [Op.lte]: b };
  res.json({
    data: await Jurnal.findAll({
      where, order: [['tanggal', 'DESC'], ['id', 'DESC']], limit: 200,
      attributes: ['id', 'tanggal', 'judul', 'status'],
    }),
  });
});

// body.tanggal dipilih peserta (YYYY-MM-DD); aksi: "kirim" untuk langsung dikirim
exports.create = asyncH(async (req, res) => {
  const tanggal = tanggalOk(req.body);
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
  try {
    await j.update({ ...ambil(req.body), tanggal, status: req.body.aksi === 'kirim' ? 'Dikirim' : j.status });
    res.json(j);
  } catch (e) {
    bentrok(e);
  }
});
