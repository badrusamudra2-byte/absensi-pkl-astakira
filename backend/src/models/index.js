const { DataTypes: T } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  nama: { type: T.STRING(100), allowNull: false },
  username: { type: T.STRING(50), allowNull: false, unique: true },
  email: { type: T.STRING(120), allowNull: false, unique: true },
  password_hash: { type: T.STRING(100), allowNull: false },
  role: { type: T.ENUM('peserta', 'pembimbing', 'admin'), allowNull: false },
  foto_url: T.STRING(255),
  aktif: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
  // Live tracking: NULL = belum pernah memberi persetujuan pelacakan pertama
  setuju_live_tracking: T.BOOLEAN,
  reset_token_hash: T.CHAR(64),
  reset_expires: T.DATE,
}, {
  tableName: 'users',
  // Kolom rahasia tidak ikut terambil kecuali memakai User.unscoped()
  defaultScope: { attributes: { exclude: ['password_hash', 'reset_token_hash', 'reset_expires'] } },
});

const Peserta = sequelize.define('Peserta', {
  user_id: { type: T.INTEGER, allowNull: false, unique: true },
  divisi: T.STRING(80),
  pembimbing_id: T.INTEGER, // id user dengan role pembimbing
}, { tableName: 'peserta' });

const Pembimbing = sequelize.define('Pembimbing', {
  user_id: { type: T.INTEGER, allowNull: false, unique: true },
  divisi: T.STRING(80),
}, { tableName: 'pembimbing' });

const Workshift = sequelize.define('Workshift', {
  hari: { type: T.ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'), allowNull: false, unique: true },
  hari_kerja: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
  jam_masuk: { type: T.TIME, allowNull: false },
  jam_pulang: { type: T.TIME, allowNull: false },
  toleransi_menit: { type: T.INTEGER, allowNull: false, defaultValue: 15 },
}, { tableName: 'workshift' });

const FaceTemplate = sequelize.define('FaceTemplate', {
  user_id: { type: T.INTEGER, allowNull: false, unique: true },
  embedding: { type: T.TEXT, allowNull: false }, // terenkripsi AES-256-GCM
  disetujui_pada: T.DATE, // waktu peserta menyetujui penggunaan data wajah
}, { tableName: 'face_templates' });

const FaceVerification = sequelize.define('FaceVerification', {
  user_id: { type: T.INTEGER, allowNull: false },
  jenis: { type: T.ENUM('masuk', 'pulang'), allowNull: false },
  kedaluwarsa_pada: { type: T.DATE, allowNull: false },
  dipakai_pada: T.DATE,
  // Foto wajah siswa (JPEG terenkripsi AES-256-GCM) sementara menunggu dipakai absensi.
  // Dipindahkan ke wajah_foto saat absensi tercatat lalu dikosongkan; tidak dikirim ke klien.
  foto_ciphertext: T.TEXT('medium'),
}, { tableName: 'face_verifications', indexes: [{ fields: ['user_id', 'jenis'] }] });

const QrToken = sequelize.define('QrToken', {
  token_hash: { type: T.CHAR(64), allowNull: false, unique: true }, // hanya hash yang disimpan
  user_id: { type: T.INTEGER, allowNull: false },
  jenis: { type: T.ENUM('masuk', 'pulang'), allowNull: false },
  kedaluwarsa_pada: { type: T.DATE, allowNull: false },
  dipindai_oleh: T.INTEGER,
  dipindai_pada: T.DATE,
  dipakai_pada: T.DATE,
  // Lokasi peserta saat menayangkan QR (server yang memvalidasi jaraknya)
  lat: T.DOUBLE,
  lng: T.DOUBLE,
  akurasi_m: T.DOUBLE,
}, { tableName: 'qr_tokens', indexes: [{ fields: ['user_id', 'jenis'] }] });

// QR ditayangkan peserta dari HP-nya dan dipindai oleh pembimbing (diganti tiap QR_TTL_DETIK).
// Satu token = milik satu peserta untuk satu jenis absen; hash disimpan,
// token mentah hanya lewat respons. Dipindai oleh pembimbing mana pun saat dipindai.

const Absensi = sequelize.define('Absensi', {
  user_id: { type: T.INTEGER, allowNull: false },
  tanggal: { type: T.DATEONLY, allowNull: false },
  jenis: { type: T.ENUM('masuk', 'pulang'), allowNull: false },
  jam: { type: T.TIME, allowNull: false },
  status: { type: T.ENUM('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Tidak hadir'), allowNull: false },
  metode: { type: T.STRING(30), allowNull: false, defaultValue: 'QR+Wajah' },
  // Keterangan izin/sakit/koreksi; kosong untuk absensi biasa dan Tidak hadir otomatis
  keterangan: T.TEXT,
  token_id: T.INTEGER,
  dikonfirmasi_oleh: T.INTEGER,
  // Titik absen peserta (dikirim perangkat peserta, divalidasi server dengan Haversine)
  lat: T.DOUBLE,
  lng: T.DOUBLE,
  akurasi_m: T.DOUBLE,
  jarak_m: T.DOUBLE,
  di_dalam_area: T.BOOLEAN,
}, {
  tableName: 'absensi',
  // Batas keras di database: satu jenis absen per peserta per hari
  indexes: [{ unique: true, name: 'uq_absensi_harian', fields: ['user_id', 'tanggal', 'jenis'] }],
});

const AbsensiPenolakan = sequelize.define('AbsensiPenolakan', {
  user_id: { type: T.INTEGER, allowNull: false },
  token_id: { type: T.INTEGER, allowNull: false },
  pembimbing_id: { type: T.INTEGER, allowNull: false },
  alasan: { type: T.TEXT, allowNull: false },
}, { tableName: 'absensi_penolakan' });

// Pengajuan izin/sakit dari peserta (dengan bukti foto dari perangkatnya).
// 'Menunggu' sampai pembimbing memutuskan; bila Disetujui, keterangan.buat()
// menulis baris absensi Izin/Sakit (hari terkunci dari QR/wajah).
const PengajuanIzin = sequelize.define('PengajuanIzin', {
  user_id: { type: T.INTEGER, allowNull: false },
  tanggal: { type: T.DATEONLY, allowNull: false },
  jenis: { type: T.ENUM('Izin', 'Sakit'), allowNull: false },
  status: { type: T.ENUM('Menunggu', 'Disetujui', 'Ditolak'), allowNull: false, defaultValue: 'Menunggu' },
  keterangan: { type: T.TEXT, allowNull: false }, // 3..1000 karakter
  bukti: { type: T.STRING(72), allowNull: false }, // nama berkas di uploads/pengajuan/
  ditangani_oleh: T.INTEGER, // id pembimbing yang memutuskan
  catatan_putusan: T.TEXT, // alasan pembimbing (wajib saat Ditolak)
}, {
  tableName: 'pengajuan_izin',
  indexes: [{ fields: ['user_id', 'tanggal'] }, { fields: ['status', 'tanggal'] }],
});

// Foto wajah siswa pada momen absensi (diambil HP siswa saat verifikasi, terenkripsi
// AES-256-GCM). Hanya admin yang bisa membaca; dihapus otomatis setelah FACE_FOTO_RETENSI_HARI.
const WajahFoto = sequelize.define('WajahFoto', {
  absensi_id: { type: T.INTEGER, allowNull: false, unique: true },
  data: { type: T.TEXT('medium'), allowNull: false }, // "iv.tag.ct" base64 JPEG terenkripsi
}, { tableName: 'wajah_foto' });

// Baris tunggal (id=1): metode absensi pengaturan penyelenggara.
const PengaturanAbsensi = sequelize.define('PengaturanAbsensi', {
  metode: { type: T.ENUM('qr_wajah', 'qr', 'wajah'), allowNull: false, defaultValue: 'qr_wajah' },
  liveness_aktif: { type: T.BOOLEAN, allowNull: false, defaultValue: true },
  // Area kantor: lat/lng NULL = validasi lokasi belum aktif (absen tanpa lokasi tetap sah)
  lat_kantor: T.DOUBLE,
  lng_kantor: T.DOUBLE,
  radius_m: { type: T.INTEGER, allowNull: false, defaultValue: 100 },
  akurasi_maks_m: { type: T.INTEGER, allowNull: false, defaultValue: 50 },
}, { tableName: 'pengaturan_absensi' });

// Tantangan liveness: nonce hash sekali pakai + instruksi gerakan dari server.
const TantanganWajah = sequelize.define('TantanganWajah', {
  user_id: { type: T.INTEGER, allowNull: false },
  nonce_hash: { type: T.CHAR(64), allowNull: false, unique: true },
  kode_gerakan: { type: T.ENUM('kedip', 'tengok_kiri', 'tengok_kanan', 'buka_mulut'), allowNull: false },
  kedaluwarsa_pada: { type: T.DATE, allowNull: false },
  dipakai_pada: T.DATE,
}, { tableName: 'tantangan_wajah', indexes: [{ fields: ['user_id', 'dipakai_pada'] }] });

const Jurnal = sequelize.define('Jurnal', {
  user_id: { type: T.INTEGER, allowNull: false },
  tanggal: { type: T.DATEONLY, allowNull: false },
  judul: { type: T.STRING(150), allowNull: false },
  uraian: { type: T.TEXT, allowNull: false },
  hasil: T.TEXT,
  kendala: T.TEXT,
  rencana: T.TEXT,
  status: { type: T.ENUM('Draft', 'Dikirim', 'Revisi', 'Disetujui'), allowNull: false, defaultValue: 'Draft' },
  lampiran: { type: T.STRING(72), allowNull: true }, // nama berkas di uploads/lampiran/ (opsional)
}, {
  tableName: 'jurnal',
  indexes: [{ fields: ['user_id', 'status'] }, { unique: true, name: 'uq_jurnal_harian', fields: ['user_id', 'tanggal'] }],
});

const JurnalReview = sequelize.define('JurnalReview', {
  jurnal_id: { type: T.INTEGER, allowNull: false },
  pembimbing_id: { type: T.INTEGER, allowNull: false },
  keputusan: { type: T.ENUM('Disetujui', 'Revisi'), allowNull: false },
  catatan: T.TEXT,
}, { tableName: 'jurnal_review' });

// Sengaja tanpa foreign key agar log tetap ada walau akun dihapus
const AuditLog = sequelize.define('AuditLog', {
  user_id: T.INTEGER,
  aksi: { type: T.STRING(150), allowNull: false },
  target: T.STRING(255),
  // Detail terstruktur (mis. koreksi: {lama, baru, alasan})
  detail: T.TEXT,
  ip: T.STRING(64),
  perangkat: T.STRING(255),
}, { tableName: 'audit_log', updatedAt: false });

// Sesi live tracking: dibuka saat absen masuk, ditutup saat absen pulang (transaksi
// yang sama) atau otomatis oleh job pada jam pulang + toleransi. Posisi terakhir
// peserta disimpan langsung di baris sesi (di-upsert) — tanpa riwayat jejak; kolom
// posisi dikosongkan saat sesi ditutup sehingga tidak ada posisi tersisa.
const SesiTracking = sequelize.define('SesiTracking', {
  user_id: { type: T.INTEGER, allowNull: false },
  tanggal: { type: T.DATEONLY, allowNull: false },
  status: { type: T.ENUM('aktif', 'selesai'), allowNull: false, defaultValue: 'aktif' },
  mulai_pada: { type: T.DATE, allowNull: false },
  ditutup_pada: T.DATE,
  sebab: T.ENUM('pulang', 'otomatis'),
  lat: T.DOUBLE,
  lng: T.DOUBLE,
  akurasi_m: T.DOUBLE,
  diperbarui_pada: T.DATE,
}, {
  tableName: 'sesi_tracking',
  indexes: [{ fields: ['user_id', 'status'] }, { fields: ['tanggal'] }],
});

User.hasOne(Peserta, { foreignKey: 'user_id', as: 'peserta' });
Peserta.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Peserta.belongsTo(User, { foreignKey: 'pembimbing_id', as: 'pembimbing' });
User.hasOne(Pembimbing, { foreignKey: 'user_id', as: 'pembimbing_profil' });
Pembimbing.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Absensi.belongsTo(User, { foreignKey: 'user_id', as: 'peserta' });
Absensi.hasOne(WajahFoto, { foreignKey: 'absensi_id', as: 'foto' });
QrToken.belongsTo(User, { foreignKey: 'user_id', as: 'peserta' });
PengajuanIzin.belongsTo(User, { foreignKey: 'user_id', as: 'peserta' });
Jurnal.belongsTo(User, { foreignKey: 'user_id', as: 'peserta' });
Jurnal.hasMany(JurnalReview, { foreignKey: 'jurnal_id', as: 'reviews' });
JurnalReview.belongsTo(User, { foreignKey: 'pembimbing_id', as: 'pembimbing' });

module.exports = {
  sequelize, User, Peserta, Pembimbing, Workshift, FaceTemplate, FaceVerification,
  QrToken, Absensi, AbsensiPenolakan, WajahFoto, Jurnal, JurnalReview, AuditLog,
  PengaturanAbsensi, TantanganWajah, PengajuanIzin, SesiTracking,
};
