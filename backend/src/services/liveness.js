const crypto = require('crypto');
const { HttpError } = require('../utils/httpError');
const { TantanganWajah } = require('../models');
const env = require('../config/env');

/** LIFENESS MODE A (pengaman dasar, pluggable):
 * Server membuat nonce sekali pakai + instruksi gerakan acak; browser yang
 * mendeteksi wajah mengukur gerakan; hasil diverifikasi server.
 *
 * BATASAN JELAS: mode ini bisa dikelabui penelepon API langsung — server hanya
 * bisa memastikan nonce telah dihabiskan, bukan gerakan nyata. Peningkatan ke
 * pemrosesan server/pihak ketiga (mode B) cukup mengganti implementasi di file
 * ini tanpa mengubah controller maupun route. */

const GERAKAN = {
  kedip: 'Kedipkan mata dua kali perlahan.',
  tengok_kiri: 'Tengok ke kiri, lalu kembali menghadap kamera.',
  tengok_kanan: 'Tengok ke kanan, lalu kembali menghadap kamera.',
  buka_mulut: 'Buka mulut, lalu tutup kembali.',
};

// Hanya dua gerakan ini yang pernah dibagikan; sisanya tetap diketahui
// agar tantangan lama yang masih tersimpan bisa terekam.
const DAFTAR = ['tengok_kiri', 'tengok_kanan'];

/** Teks instruksi untuk pesan UI (frontend memakai kode, teks tersedia di sini). */
exports.teksGerakan = (k) => GERAKAN[k] || 'Ikuti instruksi di layar.';

/** Buat tantangan baru untuk user: matikan tantangan lama yang belum dipakai. */
exports.buat = async function buatTantangan(user_id) {
  await TantanganWajah.update(
    { kedaluwarsa_pada: new Date() },
    { where: { user_id, dipakai_pada: null } },
  );
  const mentah = crypto.randomBytes(24).toString('base64url');
  const kode = DAFTAR[Math.floor(Math.random() * DAFTAR.length)];
  const kedaluwarsa = new Date(Date.now() + env.face.tantanganTtl * 1000);
  await TantanganWajah.create({
    user_id,
    nonce_hash: crypto.createHash('sha256').update(mentah).digest('hex'),
    kode_gerakan: kode,
    kedaluwarsa_pada: kedaluwarsa,
  });
  return { nonce: mentah, kode_gerakan: kode, kedaluwarsa_pada: kedaluwarsa, berlaku_detik: env.face.tantanganTtl };
};

/** Tandai nonce terpakai. Melempar bila nonce hilang, sudah dipakai, atau kedaluwarsa.
 * Difilter per user agar nonce milik orang lain tidak dapat dimanfaatkan. */
exports.periksa = async function periksaTantangan(user_id, nonce, transaksi) {
  if (typeof nonce !== 'string' || nonce.length < 10 || nonce.length > 100) {
    throw new HttpError(422, 'Hasil tantangan liveness belum dikirim.', 'TANTANGAN_WAJIB');
  }
  const hash = crypto.createHash('sha256').update(nonce).digest('hex');
  const t = await TantanganWajah.findOne({ where: { user_id, nonce_hash: hash }, transaction: transaksi });
  if (!t) throw new HttpError(404, 'Tantangan tidak dikenali.', 'TANTANGAN_TAK_ADA');
  if (t.dipakai_pada) {
    throw new HttpError(409, 'Tantangan sudah dipakai. Minta tantangan baru.', 'TANTANGAN_SUDAH');
  }
  if (new Date(t.kedaluwarsa_pada).getTime() <= Date.now()) {
    throw new HttpError(410, 'Tantangan kedaluwarsa. Minta tantangan baru.', 'TANTANGAN_KEDALUWARSA');
  }
  await t.update({ dipakai_pada: new Date() }, { transaction: transaksi });
  return t;
};
