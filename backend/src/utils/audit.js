const { AuditLog } = require('../models');

// Gagal mencatat audit tidak boleh menggagalkan permintaan utama.
// detail: objek terstruktur opsional (mis. koreksi {lama, baru, alasan}).
module.exports = async (req, aksi, target = '', detail = null) => {
  try {
    await AuditLog.create({
      user_id: req.user ? req.user.id : null,
      aksi: String(aksi).slice(0, 150),
      target: String(target).slice(0, 255),
      // Detail disimpan sebagai JSON agar nilai lama/baru bisa dibandingkan kelak
      detail: detail ? JSON.stringify(detail) : null,
      ip: req.ip,
      perangkat: (req.headers['user-agent'] || '').slice(0, 255),
    });
  } catch (e) {
    console.error('Audit gagal dicatat:', e.message);
  }
};
