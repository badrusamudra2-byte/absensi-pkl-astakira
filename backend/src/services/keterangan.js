const { Absensi } = require('../models');
const { HttpError } = require('../utils/httpError');
const { bagian } = require('../utils/waktu');
const env = require('../config/env');

// Tanggal YYYY-MM-DD: kalender sah, tidak boleh masa depan, maksimal maksBuka hari ke belakang
const tanggalOk = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new HttpError(400, 'Tanggal harus berformat YYYY-MM-DD.', 'VALIDASI');
  }
  const [y, m, h] = s.split('-').map(Number);
  const sah = m >= 1 && m <= 12 && h >= 1 && h <= 31
    && new Date(Date.UTC(y, m - 1, h)).toISOString().slice(0, 10) === s;
  if (!sah) throw new HttpError(400, 'Tanggal tidak valid.', 'VALIDASI');
  const kini = new Date(`${bagian().tanggal}T00:00:00Z`);
  const hari = new Date(Date.UTC(y, m - 1, h));
  if (hari > kini) throw new HttpError(400, 'Tanggal catatan tidak boleh di masa depan.', 'VALIDASI');
  const batas = new Date(kini.getTime() - env.jurnal.maksBuka * 86400000);
  if (hari < batas) {
    throw new HttpError(400, `Catatan maksimal untuk ${env.jurnal.maksBuka} hari ke belakang.`, 'VALIDASI');
  }
  return s;
};

/**
 * Catat Izin/Sakit untuk satu peserta pada satu tanggal.
 * Menempati slot absen masuk (uq_absensi_harian) sehingga QR dan absensi wajah
 * hari itu otomatis terkunci. Dipakai pembimbing (bimbingannya) dan admin (siapa saja).
 */
const buat = async ({ user_id, tanggal, status, keterangan, oleh }) => {
  const st = String(status || '').trim();
  if (!['Izin', 'Sakit'].includes(st)) {
    throw new HttpError(400, 'Status harus Izin atau Sakit.', 'VALIDASI');
  }
  const ket = String(keterangan ?? '').trim();
  if (ket.length < 3) throw new HttpError(400, 'Tulis keterangan minimal 3 karakter.', 'VALIDASI');
  if (ket.length > 1000) {
    throw new HttpError(400, 'Keterangan maksimal 1000 karakter.', 'VALIDASI');
  }
  const tgl = tanggalOk(String(tanggal ?? '').trim());

  const ada = await Absensi.findOne({ where: { user_id, tanggal: tgl } });
  if (ada) {
    throw new HttpError(
      409,
      ['Izin', 'Sakit'].includes(ada.status)
        ? `${st} untuk tanggal ini sudah pernah dicatat.`
        : `Peserta ini sudah punya absensi pada ${tgl}. Koreksi lewat menu koreksi admin bila perlu.`,
      'CATATAN_ADA',
    );
  }

  try {
    return await Absensi.create({
      user_id, tanggal: tgl, jenis: 'masuk', jam: bagian().jam, status: st,
      metode: st, keterangan: ket, dikonfirmasi_oleh: oleh,
    });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, 'Hari itu sudah punya catatan absensi.', 'CATATAN_ADA');
    }
    throw e;
  }
};

module.exports = { buat };
