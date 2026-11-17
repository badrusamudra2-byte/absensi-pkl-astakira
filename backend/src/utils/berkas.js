const path = require('path');
const fs = require('fs');

// Semua berkas unggahan berada di bawah satu root: backend/uploads (default),
// atau UPLOAD_DIR dari .env — dipakai tes agar tidak menyentuh berkas asli.
const root = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../..', 'uploads'));

const siapkan = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/** foto_url '/uploads/foto/x.jpg' -> path disk di bawah root; null bila tidak sah. */
const urlKePath = (url) => {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  return path.join(root, url.slice('/uploads/'.length));
};

module.exports = {
  root,
  foto: siapkan(path.join(root, 'foto')),
  pengajuan: siapkan(path.join(root, 'pengajuan')),
  lampiran: siapkan(path.join(root, 'lampiran')),
  urlKePath,
};
