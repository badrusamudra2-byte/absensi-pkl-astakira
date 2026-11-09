// Validasi foto wajah dari klien (JPEG base64/data URL) dan penyiapan tersimpannya.
// Foto dienkripsi AES-256-GCM (kunci FACE_KEY); bentuk tersimpan "iv.tag.ct" base64.
const { HttpError } = require('../utils/httpError');
const config = require('../config/env');
const { enkripBait } = require('../utils/crypto');

const TANDA_DATA_URL = 'data:image/jpeg;base64,';

/** Kembalikan ciphertext foto yang sah, atau null bila tidak ada foto dikirim.
 * Melempar HttpError bila foto disertakan tetapi tidak sah. */
module.exports = function siapkanFoto(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') {
    throw new HttpError(422, 'Foto wajah tidak valid, ulangi verifikasi.', 'FOTO_BUKAN_JPEG');
  }
  let b64 = raw;
  if (b64.startsWith(TANDA_DATA_URL)) b64 = b64.slice(TANDA_DATA_URL.length);
  const bait = Buffer.from(b64, 'base64');
  const sah = /^[A-Za-z0-9+/=\r\n]+$/.test(b64) && bait.length > 3
    && bait[0] === 0xff && bait[1] === 0xd8 && bait[2] === 0xff;
  if (!sah) throw new HttpError(422, 'Foto wajah harus berformat JPEG, ulangi verifikasi.', 'FOTO_BUKAN_JPEG');
  if (bait.length > config.face.foto.maksBait) {
    throw new HttpError(422, 'Foto wajah terlalu besar, ulangi verifikasi.', 'FOTO_TERLALU_BESAR');
  }
  return enkripBait(bait);
};
