const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { sequelize, Absensi, Peserta, PengajuanIzin, User } = require('../models');
const { HttpError, asyncH } = require('../utils/httpError');
const { bagian } = require('../utils/waktu');
const audit = require('../utils/audit');
const keteranganBuat = require('../services/keterangan').buat;
const berkas = require('../utils/berkas');
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
const TGL_RE = /^\d{4}-\d{2}-\d{2}$/;
const hariMs = (iso) => new Date(`${iso}T00:00:00Z`).getTime();

/** Kalender sah (YYYY-MM-DD) tanpa batas maju/mundur. */
const tanggalSah = (s) => {
  const t = String(s ?? '').trim();
  if (!TGL_RE.test(t)) throw new HttpError(400, 'Tanggal harus berformat YYYY-MM-DD.', 'VALIDASI');
  const [y, m, h] = t.split('-').map(Number);
  const sah = m >= 1 && m <= 12 && h >= 1 && h <= 31
    && new Date(Date.UTC(y, m - 1, h)).toISOString().slice(0, 10) === t;
  if (!sah) throw new HttpError(400, 'Tanggal tidak valid.', 'VALIDASI');
  return t;
};

/** Kalender sah + batas maju/mundur yang sama untuk tanggal mulai maupun akhir. */
const tanggalOk = (s) => {
  const t = tanggalSah(s);
  const kini = hariMs(bagian().tanggal);
  const hari = hariMs(t);
  const batasMaju = kini + env.pengajuan.maksMaju * 86400000;
  if (hari > batasMaju) {
    throw new HttpError(
      400,
      `Pengajuan maksimal untuk ${env.pengajuan.maksMaju} hari ke depan.`,
      'VALIDASI',
    );
  }
  const batas = kini - env.jurnal.maksBuka * 86400000;
  if (hari < batas) {
    throw new HttpError(
      400,
      `Pengajuan maksimal untuk ${env.jurnal.maksBuka} hari ke belakang.`,
      'VALIDASI',
    );
  }
  return t;
};

<<<<<<< Updated upstream
/** Daftar tanggal ISO dalam rentang inklusif [mulai, selesai]. */
const daftarTanggal = (mulai, selesai) => {
  const hasil = [];
  for (let t = hariMs(mulai); t <= hariMs(selesai); t += 86400000) {
    hasil.push(new Date(t).toISOString().slice(0, 10));
  }
  return hasil;
};

/** Tanggal mulai & akhir periode yang sudah divalidasi; akhir >= mulai. */
const rentangOk = (mulaiRaw, selesaiRaw) => {
  const mulai = tanggalOk(mulaiRaw || bagian().tanggal);
  const selesai = tanggalOk(selesaiRaw || mulai);
  if (selesai < mulai) {
    throw new HttpError(400, 'Tanggal selesai tidak boleh sebelum tanggal mulai.', 'VALIDASI');
  }
  return { mulai, selesai };
};

/** Peserta kirim pengajuan izin/sakit untuk satu tanggal atau periode + bukti foto. */
exports.kirim = asyncH(async (req, res) => {
  const uid = req.user.id;
  // Berkas sudah ditulis multer sebelum controller berjalan. Siapkan pembersih
  // lebih awal supaya galat validasi apa pun tidak meninggalkan berkas yatim.
=======
const hariKe = (s) => new Date(`${s}T00:00:00Z`);

/** Daftar tanggal YYYY-MM-DD inklusif dari `mulai` sampai `akhir`. */
const daftarHari = (mulai, akhir) => {
  const hari = [];
  const batas = hariKe(akhir).getTime();
  for (let t = hariKe(mulai).getTime(); t <= batas; t += 86400000) {
    hari.push(new Date(t).toISOString().slice(0, 10));
  }
  return hari;
};

/** Validasi rentang pengajuan: kedua ujung dalam batas, akhir >= mulai, dan
 * panjangnya maksimal env.pengajuan.maksHari hari inklusif. `akhir` disimpan
 * NULL bila rentangnya hanya satu hari (sama seperti data lama). */
const rentangOk = (mulaiAwal, akhirAwal) => {
  const mulai = tanggalOk(mulaiAwal);
  const akhir = akhirAwal ? tanggalOk(akhirAwal) : mulai;
  if (akhir < mulai) {
    throw new HttpError(400, 'Tanggal akhir tidak boleh sebelum tanggal mulai.', 'VALIDASI');
  }
  const hari = daftarHari(mulai, akhir);
  if (hari.length > env.pengajuan.maksHari) {
    throw new HttpError(
      400,
      `Pengajuan izin/sakit maksimal ${env.pengajuan.maksHari} hari berturut-turut.`,
      'VALIDASI',
    );
  }
  return { mulai, akhir: akhir === mulai ? null : akhir, hari };
};

/** Peserta kirim pengajuan izin/sakit + bukti foto (req.file dari uploadBukti). */
exports.kirim = asyncH(async (req, res) => {
  const uid = req.user.id;
  const jenis = jenisOk(req.body.jenis);
  const { mulai: tanggal, akhir: tanggalAkhir, hari } = rentangOk(
    req.body.tanggal || bagian().tanggal,
    req.body.tanggal_akhir,
  );
  const labelRentang = tanggalAkhir ? `${tanggal} s.d. ${tanggalAkhir}` : tanggal;
  const ket = String(req.body.keterangan ?? '').trim();
  if (ket.length < 3 || ket.length > 1000) {
    throw new HttpError(400, 'Keterangan wajib 3 sampai 1000 karakter.', 'VALIDASI');
  }
  if (!req.file || !req.file.filename) {
    throw new HttpError(400, 'Lampirkan bukti berupa foto.', 'BUKTI_WAJIB');
  }
  // Berkas bukti sudah ditulis middleware ke uploads/pengajuan. Bila validasi
  // di bawah gagal, berkas wajib dihapus agar tidak menumpuk sebagai berkas yatim.
>>>>>>> Stashed changes
  const hapusBukti = () => {
    if (!req.file || !req.file.filename) return;
    try { fs.unlinkSync(path.join(berkas.pengajuan, req.file.filename)); } catch { /* sudah tak ada */ }
  };
  let mulai = '';
  let selesai = '';

  try {
<<<<<<< Updated upstream
    const jenis = jenisOk(req.body.jenis);
    ({ mulai, selesai } = rentangOk(req.body.tanggal, req.body.tanggal_selesai));
    const tanggalList = daftarTanggal(mulai, selesai);
    const ket = String(req.body.keterangan ?? '').trim();
    if (ket.length < 3 || ket.length > 1000) {
      throw new HttpError(400, 'Keterangan wajib 3 sampai 1000 karakter.', 'VALIDASI');
    }
    if (!req.file || !req.file.filename) {
      throw new HttpError(400, 'Lampirkan bukti berupa foto.', 'BUKTI_WAJIB');
    }
    // Tanggal mana pun dalam periode yang sudah punya catatan absensi atau pengajuan
    // aktif menutup pengajuan ini. Cek dan tulis dalam satu transaksi (kunci baris
    // yang ada) supaya dua pengiriman bersamaan tidak sama-sama lolos cek duplikat.
    const p = await sequelize.transaction(async (t) => {
      const adaAbsensi = await Absensi.findOne({
        where: { user_id: uid, tanggal: { [Op.in]: tanggalList } },
        transaction: t, lock: t.LOCK.UPDATE,
=======
    // Setiap hari dalam rentang tidak boleh sudah punya catatan absensi maupun
    // pengajuan aktif lain. Cek dan tulis dalam satu transaksi (kunci baris yang
    // ada) supaya dua pengiriman bersamaan tidak sama-sama lolos cek duplikat.
    const p = await sequelize.transaction(async (t) => {
      const adaAbsensi = await Absensi.findAll({
        where: { user_id: uid, tanggal: { [Op.in]: hari } },
        transaction: t,
        lock: t.LOCK.UPDATE,
>>>>>>> Stashed changes
      });
      if (adaAbsensi.length) {
        const a = adaAbsensi.sort((x, y) => (x.tanggal < y.tanggal ? -1 : 1))[0];
        throw new HttpError(
          409,
<<<<<<< Updated upstream
          ['Izin', 'Sakit'].includes(adaAbsensi.status)
            ? `${adaAbsensi.tanggal} sudah tercatat ${adaAbsensi.status}.`
            : `Anda sudah punya absensi pada ${adaAbsensi.tanggal}.`,
          'CATATAN_ADA',
        );
      }
      // Pengajuan aktif (Menunggu/Disetujui) yang rentangnya beririsan juga menutup duplikat
=======
          ['Izin', 'Sakit'].includes(a.status)
            ? `${a.tanggal} sudah tercatat ${a.status}.`
            : `Anda sudah punya absensi pada ${a.tanggal}.`,
          'CATATAN_ADA',
        );
      }
      // Pengajuan aktif (Menunggu/Disetujui) yang rentangnya bertabrakan juga
      // menutup duplikat: mulai_lama <= akhir_baru DAN akhir_lama >= mulai_baru.
>>>>>>> Stashed changes
      const adaAjukan = await PengajuanIzin.findOne({
        where: {
          user_id: uid,
          status: { [Op.ne]: 'Ditolak' },
<<<<<<< Updated upstream
          [Op.and]: [
            { tanggal: { [Op.lte]: selesai } },
            {
              [Op.or]: [
                { tanggal_selesai: { [Op.gte]: mulai } },
                { [Op.and]: [{ tanggal_selesai: null }, { tanggal: { [Op.gte]: mulai } }] },
              ],
            },
=======
          tanggal: { [Op.lte]: tanggalAkhir || tanggal },
          [Op.or]: [
            { tanggal_akhir: null, tanggal: { [Op.gte]: tanggal } },
            { tanggal_akhir: { [Op.gte]: tanggal } },
>>>>>>> Stashed changes
          ],
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (adaAjukan) {
<<<<<<< Updated upstream
        const akhir = adaAjukan.tanggal_selesai || adaAjukan.tanggal;
        const rentang = akhir === adaAjukan.tanggal ? adaAjukan.tanggal : `${adaAjukan.tanggal} s/d ${akhir}`;
        throw new HttpError(409, `Sudah ada pengajuan ${adaAjukan.jenis.toLowerCase()} untuk ${rentang} (status ${adaAjukan.status}).`, 'CATATAN_ADA');
      }

      return PengajuanIzin.create({
        user_id: uid, tanggal: mulai, tanggal_selesai: selesai,
        jenis, keterangan: ket, bukti: req.file.filename,
      }, { transaction: t });
    });
    await audit(req, `Pengajuan ${jenis} ${mulai}${selesai !== mulai ? ` s/d ${selesai}` : ''}`, `pes#${uid} pengajuan#${p.id}`);
    res.status(201).json({
      pesan: `Pengajuan ${jenis} terkirim, menunggu persetujuan pembimbing.`,
      data: { id: p.id, status: p.status, tanggal: p.tanggal, tanggal_selesai: p.tanggal_selesai },
    });
=======
        const rentangLama = `${adaAjukan.tanggal}${adaAjukan.tanggal_akhir ? ` s.d. ${adaAjukan.tanggal_akhir}` : ''}`;
        throw new HttpError(409, `Sudah ada pengajuan ${adaAjukan.jenis.toLowerCase()} untuk ${rentangLama} (status ${adaAjukan.status}).`, 'CATATAN_ADA');
      }

      return PengajuanIzin.create({
        user_id: uid, tanggal, tanggal_akhir: tanggalAkhir, jenis, keterangan: ket, bukti: req.file.filename,
      }, { transaction: t });
    });
    await audit(req, `Pengajuan ${jenis} ${labelRentang}`, `pes#${uid} pengajuan#${p.id}`);
    res.status(201).json({ pesan: `Pengajuan ${jenis} terkirim, menunggu persetujuan pembimbing.`, data: { id: p.id, status: p.status } });
>>>>>>> Stashed changes
  } catch (e) {
    hapusBukti();
    // Dua kirim bersamaan bisa saling mengunci (deadlock InnoDB): perlakukan
    // seperti duplikat, bukan 500 server error.
    if (e.parent?.code === 'ER_LOCK_DEADLOCK') {
<<<<<<< Updated upstream
      throw new HttpError(409, `Sudah ada pengajuan/absensi untuk ${mulai}${selesai !== mulai ? ` s/d ${selesai}` : ''}.`, 'CATATAN_ADA');
=======
      throw new HttpError(409, `Sudah ada pengajuan/absensi untuk ${labelRentang}.`, 'CATATAN_ADA');
>>>>>>> Stashed changes
    }
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

  res.sendFile(path.join(berkas.pengajuan, nama));
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

/** Notifikasi pembimbing: ada pengajuan Menunggu yang mencakup hari ini? (lingkaran merah di menu) */
exports.notifikasi = asyncH(async (req, res) => {
  const ids = await idBimbingan(req.user.id);
  if (!ids.length) return res.json({ ada: false });
<<<<<<< Updated upstream
  const hariIni = bagian().tanggal;
  const ada = await PengajuanIzin.count({
    where: {
      user_id: ids, status: 'Menunggu',
      [Op.and]: [
        { tanggal: { [Op.lte]: hariIni } },
        {
          [Op.or]: [
            { tanggal_selesai: { [Op.gte]: hariIni } },
            { [Op.and]: [{ tanggal_selesai: null }, { tanggal: hariIni }] },
          ],
        },
=======
  const tgl = bagian().tanggal;
  const ada = await PengajuanIzin.count({
    where: {
      user_id: ids,
      status: 'Menunggu',
      tanggal: { [Op.lte]: tgl },
      // Rentang Menunggu yang mencakup hari ini, termasuk pengajuan satu hari (tanggal_akhir NULL)
      [Op.or]: [
        { tanggal_akhir: null, tanggal: { [Op.gte]: tgl } },
        { tanggal_akhir: { [Op.gte]: tgl } },
>>>>>>> Stashed changes
      ],
    },
  });
  res.json({ ada: ada > 0 });
});

/** Pembimbing memutuskan: Setujui (daya terkunci Izin/Sakit) atau Tolak dengan alasan. */
exports.putuskan = asyncH(async (req, res) => {
  const pid = req.user.id; // id user pembimbing
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'ID pengajuan tidak valid.', 'VALIDASI');
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
<<<<<<< Updated upstream
      // Tulis baris absensi izin/sakit untuk tiap tanggal dalam periode (hari terkunci
      // dari QR/wajah); peserta lain tak sempat absen. Bila satu tanggal saja sudah
      // punya catatan, keteranganBuat melempar CATATAN_ADA dan seluruh transaksi batal.
      // Hanya batas 7-hari ke belakang yang dilewati (lewatiBatas): tanggalnya sudah
      // tervalidasi saat pengajuan dikirim, jadi keputusan yang telat tetap bisa disetujui.
      // Tanggal depan boleh sampai batas pengajuan.maksMaju (dicek ulang di
      // services/keterangan.js) — baris langsung dibuat dan mengunci hari itu.
      for (const tgl of daftarTanggal(p.tanggal, p.tanggal_selesai || p.tanggal)) {
        await keteranganBuat({
          user_id: p.user_id, tanggal: tgl, status: p.jenis,
=======
      // Tulis baris absensi Izin/Sakit untuk SETIAP hari dalam rentang (hari
      // terkunci dari QR/wajah); semua dalam transaksi yang sama sehingga
      // persetujuan tidak pernah setengah jadi.
      // Hanya batas 7-hari ke belakang yang dilewati (lewatiBatas): tanggalnya sudah
      // tervalidasi saat pengajuan dikirim, jadi keputusan yang telat tetap bisa
      // disetujui. Tanggal depan tetap dibatasi pengajuan.maksMaju (dicek ulang di
      // services/keterangan.js).
      const hari = daftarHari(p.tanggal, p.tanggal_akhir || p.tanggal);
      for (const tanggal of hari) {
        await keteranganBuat({
          user_id: p.user_id, tanggal, status: p.jenis,
>>>>>>> Stashed changes
          keterangan: p.keterangan, oleh: pid,
        }, { transaction: t, lewatiBatas: true });
      }
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
