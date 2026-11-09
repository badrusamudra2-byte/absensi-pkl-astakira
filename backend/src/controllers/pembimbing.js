const { Op, fn } = require('sequelize');
const { sequelize, Peserta, User, Absensi, Jurnal, JurnalReview } = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');
const { bagian, rentang } = require('../utils/waktu');
const audit = require('../utils/audit');

const idBimbingan = async (pid) => (await Peserta.findAll({ where: { pembimbing_id: pid }, attributes: ['user_id'] })).map((p) => p.user_id);

exports.ringkasan = asyncH(async (req, res) => {
  const ids = await idBimbingan(req.user.id);
  const w = bagian();
  const [hadir, review] = await Promise.all([
    Absensi.count({ where: { user_id: ids, tanggal: w.tanggal, jenis: 'masuk' } }),
    Jurnal.count({ where: { user_id: ids, status: 'Dikirim' } }),
  ]);
  res.json({ jumlah_peserta: ids.length, hadir_hari_ini: hadir, perlu_review: review });
});

exports.peserta = asyncH(async (req, res) => {
  const list = await Peserta.findAll({
    where: { pembimbing_id: req.user.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'nama', 'email', 'aktif', 'foto_url'] }],
  });
  const ids = list.map((p) => p.user_id);
  const dari = bagian(new Date(Date.now() - 30 * 864e5)).tanggal;
  const agg = ids.length
    ? await Absensi.findAll({
        attributes: ['user_id', 'status', [fn('COUNT', '*'), 'n']],
        where: { user_id: ids, jenis: 'masuk', tanggal: { [Op.gte]: dari } },
        group: ['user_id', 'status'], raw: true,
      })
    : [];
  res.json({
    data: list.map((p) => {
      const rekap = {};
      agg.filter((a) => a.user_id === p.user_id).forEach((a) => { rekap[a.status] = Number(a.n); });
      return { id: p.user_id, nama: p.user.nama, email: p.user.email, aktif: p.user.aktif, divisi: p.divisi, rekap_30_hari: rekap };
    }),
  });
});

exports.jurnal = asyncH(async (req, res) => {
  const ids = await idBimbingan(req.user.id);
  const where = { user_id: ids, status: { [Op.ne]: 'Draft' } }; // draft milik peserta tidak terlihat
  if (['Dikirim', 'Revisi', 'Disetujui'].includes(req.query.status)) where.status = req.query.status;
  const data = await Jurnal.findAll({
    where, order: [['tanggal', 'DESC'], ['id', 'DESC']], limit: 200,
    include: [{ model: User, as: 'peserta', attributes: ['id', 'nama'] }],
  });
  res.json({ data });
});

exports.detailJurnal = asyncH(async (req, res) => {
  const ids = await idBimbingan(req.user.id);
  const j = await Jurnal.findOne({
    where: { id: req.params.id, user_id: ids, status: { [Op.ne]: 'Draft' } },
    include: [
      { model: User, as: 'peserta', attributes: ['id', 'nama'] },
      { model: JurnalReview, as: 'reviews' },
    ],
  });
  if (!j) throw new HttpError(404, 'Jurnal tidak ditemukan.', 'TIDAK_ADA');
  res.json(j);
});

exports.review = asyncH(async (req, res) => {
  const { keputusan } = req.body;
  const catatan = String(req.body.catatan || '').trim();
  if (!['setujui', 'revisi'].includes(keputusan)) throw new HttpError(400, 'Keputusan harus setujui atau revisi.', 'VALIDASI');
  if (keputusan === 'revisi' && catatan.length < 3) {
    throw new HttpError(400, 'Tulis alasan revisi agar peserta tahu bagian yang perlu diperbaiki.', 'VALIDASI');
  }
  const ids = await idBimbingan(req.user.id);
  const j = await Jurnal.findOne({ where: { id: req.params.id, user_id: ids } });
  if (!j) throw new HttpError(404, 'Jurnal tidak ditemukan.', 'TIDAK_ADA');
  if (j.status !== 'Dikirim') throw new HttpError(409, 'Hanya jurnal berstatus Dikirim yang bisa direview.', 'STATUS_TIDAK_VALID');

  const baru = keputusan === 'setujui' ? 'Disetujui' : 'Revisi';
  await sequelize.transaction(async (t) => {
    await JurnalReview.create(
      { jurnal_id: j.id, pembimbing_id: req.user.id, keputusan: baru, catatan: catatan.slice(0, 2000) || null },
      { transaction: t },
    );
    await j.update({ status: baru }, { transaction: t });
  });
  await audit(req, `${baru === 'Disetujui' ? 'Setujui' : 'Minta revisi'} jurnal`, `jurnal#${j.id}`);
  res.json({ pesan: baru === 'Disetujui' ? 'Jurnal disetujui.' : 'Permintaan revisi dikirim ke peserta.', status: baru });
});

exports.rekap = asyncH(async (req, res) => {
  const ids = await idBimbingan(req.user.id);
  // Filter per peserta opsional; kepemilikan tetap dibatasi ke bimbingan
  const uid = Number(req.query.user_id);
  const daftar = Number.isInteger(uid) && ids.includes(uid) ? [uid] : ids;
  const r = rentang(req.query);
  const w = r ? { tanggal: r } : {};
  const [absensi, jurnal] = await Promise.all([
    Absensi.findAll({
      where: { user_id: daftar, ...w }, order: [['tanggal', 'DESC'], ['jam', 'ASC']], limit: 1000,
      include: [{ model: User, as: 'peserta', attributes: ['id', 'nama'] }],
    }),
    Jurnal.findAll({
      where: { user_id: daftar, status: { [Op.ne]: 'Draft' }, ...w }, order: [['tanggal', 'DESC']], limit: 1000,
      attributes: ['id', 'tanggal', 'judul', 'status'],
      include: [{ model: User, as: 'peserta', attributes: ['id', 'nama'] }],
    }),
  ]);
  res.json({ absensi, jurnal });
});
