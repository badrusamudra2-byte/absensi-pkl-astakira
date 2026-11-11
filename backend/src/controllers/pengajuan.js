const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { sequelize, Absensi, Peserta, PengajuanIzin, User } = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');
const { bagian } = require('../utils/waktu');
const audit = require('../utils/audit');
const keteranganBuat = require('../services/keterangan').buat;
const env = require('../config/env');

// Peserta.pembimbing_id menyimpan user id pembimbing
const idBimbingan = async (pid) => (await Peserta.findAll({
  where: { pembimbing_id: pid }, attributes: ['user_id'],
})).map((p) => p.user_id);

const jenisOk = (j) => {
  if (!['Izin', 'Sakit'].includes(j)) throw new HttpError(400, 'Jenis pengajuan harus Izin atau Sakit.', 'VALIDASI');
  return j;
};

// Tanggal YYYY-MM-DD: kalender sah, mengaju sampai PENGAJUAN_MAKS_HARI_MAJU,
// mundur maksimal JURNAL_MAKS_HARI_BELAKANG
const tanggalOk = (s) => {
  const t = String(s ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new HttpError(400, 'Tanggal harus berformat YYYY-MM-DD.', 'VALIDASI');
  const [y, m, h] = t.split('-').map(Number);
  const sah = m >= 1 && m <= 12 && h >= 1 && h <= 31
    && new Date(Date.UTC(y, m - 1, h)).toISOString().slice(0, 10) === t;
  if (!sah) throw new HttpError(400, 'Tanggal tidak valid.', 'VALIDASI');
  const kini = new Date(`${bagian().tanggal}T00:00:00Z`);
  const hari = new Date(Date.UTC(y, m - 1, h));
  const batasMaju = new Date(kini.getTime() + env.pengajuan.maksMaju * 86400000);
  if (hari > batasMaju) {
    throw new HttpError(
      400,
      `Pengajuan maksimal untuk ${env.pengajuan.maksMaju} hari ke depan.`,
      'VALIDASI',
    );
  }
  const batas = new Date(kini.getTime() - env.jurnal.maksBuka * 86400000);
  if (hari < batas) {
    throw new HttpError(
      400,
      `Pengajuan maksimal untuk ${env.jurnal.maksBuka} hari ke belakang.`,
      'VALIDASI',
    );
  }
  return t;
};

/** Peserta kirim pengajuan izin/sakit + bukti foto (req.file dari uploadBukti). */
exports.kirim = asyncH(async (req, res) => {
  const uid = req.user.id;
  const jenis = jenisOk(req.body.jenis);
  const tanggal = tanggalOk(req.body.tanggal || bagian().tanggal);
  const ket = String(req.body.keterangan ?? '').trim();
  if (ket.length < 3 || ket.length > 1000) {
    throw new HttpError(400, 'Keterangan wajib 3 sampai 1000 karakter.', 'VALIDASI');
  }
  if (!req.file || !req.file.filename) {
    throw new HttpError(400, 'Lampirkan bukti berupa foto.', 'BUKTI_WAJIB');
  }
  // Berkas bukti sudah ditulis middleware ke uploads/pengajuan. Bila validasi
  // di bawah gagal, berkas wajib dihapus agar tidak menumpuk sebagai berkas yatim.
  const hapusBukti = () => {
    try { fs.unlinkSync(path.join(__dirname, '../../uploads/pengajuan', req.file.filename)); } catch { /* sudah tak ada */ }
  };

  try {
    // Hari itu sudah memuat catatan absensi apa pun -> tidak bisa diajukan lagi.
    // Cek dan tulis dalam satu transaksi (kunci baris yang ada) supaya dua
    // pengiriman bersamaan tidak sama-sama lolos cek duplikat.
    const p = await sequelize.transaction(async (t) => {
      const adaAbsensi = await Absensi.findOne({ where: { user_id: uid, tanggal }, transaction: t });
      if (adaAbsensi) {
        throw new HttpError(
          409,
          ['Izin', 'Sakit'].includes(adaAbsensi.status)
            ? `${tanggal} sudah tercatat ${adaAbsensi.status}.`
            : `Anda sudah punya absensi pada ${tanggal}.`,
          'CATATAN_ADA',
        );
      }
      // Pengajuan aktif (Menunggu/Disetujui) pada tanggal sama juga menutup duplikat
      const adaAjukan = await PengajuanIzin.findOne({
        where: { user_id: uid, tanggal, status: { [Op.ne]: 'Ditolak' } },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (adaAjukan) {
        throw new HttpError(409, `Sudah ada pengajuan ${adaAjukan.jenis.toLowerCase()} untuk ${tanggal} (status ${adaAjukan.status}).`, 'CATATAN_ADA');
      }

      return PengajuanIzin.create({
        user_id: uid, tanggal, jenis, keterangan: ket, bukti: req.file.filename,
      }, { transaction: t });
    });
    await audit(req, `Pengajuan ${jenis} ${tanggal}`, `pes#${uid} pengajuan#${p.id}`);
    res.status(201).json({ pesan: `Pengajuan ${jenis} terkirim, menunggu persetujuan pembimbing.`, data: { id: p.id, status: p.status } });
  } catch (e) {
    hapusBukti();
    throw e;
  }
});

/** Buka berkas bukti pengajuan (foto): hanya pemilik pengajuan, pembimbing
 * bimbingannya, atau admin. Nama berkas divalidasi ketat untuk mencegah
 * path traversal; berkas dilayani dari uploads/pengajuan. */
exports.bukti = asyncH(async (req, res) => {
  const nama = String(req.params.berkas || '');
  if (!/^[0-9a-f]{32}\.(jpe?g|png|webp)$/i.test(nama)) {
    throw new HttpError(404, 'Berkas bukti tidak ditemukan.', 'TIDAK_ADA');
  }
  const p = await PengajuanIzin.findOne({ where: { bukti: nama }, attributes: ['id', 'user_id'] });
  if (!p) throw new HttpError(404, 'Berkas bukti tidak ditemukan.', 'TIDAK_ADA');

  let boleh = req.user.role === 'admin' || p.user_id === req.user.id;
  if (!boleh && req.user.role === 'pembimbing') {
    const ids = await idBimbingan(req.user.id);
    boleh = ids.includes(p.user_id);
  }
  if (!boleh) throw new HttpError(403, 'Bukti ini bukan pengajuan Anda atau bimbingan Anda.', 'DILARANG');

  res.sendFile(path.join(__dirname, '../../uploads/pengajuan', nama));
});

/** Daftar pengajuan: peserta melihat miliknya; pembimbing melihat bimbingannya. */
exports.daftar = asyncH(async (req, res) => {
  let where;
  if (req.user.role === 'peserta') {
    where = { user_id: req.user.id };
  } else {
    // Pembimbing: hanya pengajuan peserta di bawah bimbingannya
    const ids = await idBimbingan(req.user.id);
    if (!ids.length) return res.json({ data: [] });
    where = { user_id: ids };
  }
  const data = await PengajuanIzin.findAll({
    where, order: [['tanggal', 'DESC'], ['id', 'DESC']], limit: 366,
    include: [{ model: User, as: 'peserta', attributes: ['id', 'nama'] }],
  });
  res.json({ data });
});

/** Notifikasi pembimbing: ada pengajuan Menunggu untuk hari ini? (lingkaran merah di menu) */
exports.notifikasi = asyncH(async (req, res) => {
  const ids = await idBimbingan(req.user.id);
  if (!ids.length) return res.json({ ada: false });
  const ada = await PengajuanIzin.count({
    where: { user_id: ids, status: 'Menunggu', tanggal: bagian().tanggal },
  });
  res.json({ ada: ada > 0 });
});

/** Pembimbing memutuskan: Setujui (daya terkunci Izin/Sakit) atau Tolak dengan alasan. */
exports.putuskan = asyncH(async (req, res) => {
  const pid = req.user.id; // id user pembimbing
  const id = Number(req.params.id);
  const putusan = String(req.body.putusan ?? '').trim();
  const alasan = String(req.body.alasan ?? '').trim();
  if (!['Disetujui', 'Ditolak'].includes(putusan)) {
    throw new HttpError(400, 'Putusan harus Disetujui atau Ditolak.', 'VALIDASI');
  }
  if (putusan === 'Ditolak' && alasan.length < 3) {
    throw new HttpError(400, 'Tulis alasan penolakan minimal 3 karakter.', 'VALIDASI');
  }

  const hasil = await sequelize.transaction(async (t) => {
    // Kunci baris pengajuan agar dua pembimbing tidak memutuskan bersamaan
    const p = await PengajuanIzin.findOne({ where: { id, status: 'Menunggu' }, transaction: t, lock: t.LOCK.UPDATE });
    if (!p) throw new HttpError(404, 'Pengajuan tidak ditemukan atau sudah diputuskan.', 'TIDAK_ADA');

    // Hanya pembimbing pengajuan yang boleh memutuskan
    const ids = await idBimbingan(pid);
    if (!ids.includes(p.user_id)) {
      throw new HttpError(403, 'Pengajuan ini bukan dari peserta bimbingan Anda.', 'BUKAN_BIMBINGAN');
    }

    if (putusan === 'Disetujui') {
      // Tulis baris absensi izin/sakit (hari terkunci dari QR/wajah); peserta lain tak sempat absen.
      // Batas 7-hari dilewati: tanggalnya sudah tervalidasi saat pengajuan dikirim, jadi
      // keputusan yang diajukan telat tetap bisa disetujui (tidak macet Menunggu).
      await keteranganBuat({
        user_id: p.user_id, tanggal: p.tanggal, status: p.jenis,
        keterangan: p.keterangan, oleh: pid,
      }, { transaction: t, lewatiBatas: true });
    }
    await p.update({
      status: putusan, ditangani_oleh: pid,
      catatan_putusan: putusan === 'Ditolak' ? alasan : null,
    }, { transaction: t });
    return p;
  });

  await audit(req, `Pengajuan ${hasil.jenis} ${putusan.toLowerCase()}`, `pes#${hasil.user_id} pengajuan#${hasil.id}`);
  res.json({ pesan: `Pengajuan ${putusan.toLowerCase()}.`, data: { id: hasil.id, status: hasil.status } });
});
