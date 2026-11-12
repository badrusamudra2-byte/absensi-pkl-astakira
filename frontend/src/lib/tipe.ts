export type Role = 'peserta' | 'pembimbing' | 'admin';
export type Jenis = 'masuk' | 'pulang';
export type StatusAbsensi = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Tidak hadir';
export type MetodeAbsensi = 'qr_wajah' | 'qr' | 'wajah';
export type KodeGerakan = 'kedip' | 'tengok_kiri' | 'tengok_kanan' | 'buka_mulut';

/** Pengaturan absensi penyelenggara (baris tunggal, dibaca semua yang login).
 * lat_kantor/lng_kantor null = validasi lokasi belum diaktifkan admin. */
export interface Pengaturan {
  id: number;
  metode: MetodeAbsensi;
  liveness_aktif: boolean;
  lat_kantor: number | null;
  lng_kantor: number | null;
  radius_m: number;
  akurasi_maks_m: number;
}

/** Tantangan liveness dari server: nonce sekali pakai + instruksi acak. */
export interface Tantangan {
  nonce: string;
  kode_gerakan: KodeGerakan;
  instruksi: string;
  kedaluwarsa_pada: string;
  berlaku_detik: number;
}

export interface User {
  id: number;
  nama: string;
  username: string;
  email: string;
  role: Role;
  foto_url: string | null;
}

/** Profil per peran; admin tidak punya profil (null). */
export interface ProfilPeserta {
  id: number;
  user_id: number;
  divisi: string | null;
  pembimbing_id: number | null;
  pembimbing?: { id: number; nama: string } | null;
}
export interface ProfilPembimbing {
  id: number;
  user_id: number;
  divisi: string | null;
}

/** Semua galat API berbentuk { pesan, kode }. */
export interface PesanApi {
  pesan: string;
  kode: string;
}

export interface Sesi {
  token: string;
  user: User;
}

export interface SesiMe extends Sesi {
  profil: ProfilPeserta | ProfilPembimbing | null;
}

/* ---------- Workshift ---------- */
export interface Workshift {
  id: number;
  hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';
  hari_kerja: boolean;
  jam_masuk: string; // "08:00:00"
  jam_pulang: string;
  toleransi_menit: number;
}

/* ---------- Absensi ---------- */
export interface Absensi {
  id: number;
  tanggal: string; // "2026-10-17"
  jenis: Jenis;
  jam: string; // "08:01:23"
  status: StatusAbsensi;
  metode: string;
  keterangan?: string | null;
  // Lokasi absen (null bila validasi lokasi belum diaktifkan admin)
  lat?: number | null;
  lng?: number | null;
  jarak_m?: number | null;
  di_dalam_area?: boolean | null;
}

/* ---------- Pengajuan izin/sakit ---------- */
export type StatusPengajuan = 'Menunggu' | 'Disetujui' | 'Ditolak';

export interface PengajuanIzin {
  id: number;
  user_id: number;
  tanggal: string; // "2026-11-09"
  jenis: 'Izin' | 'Sakit';
  status: StatusPengajuan;
  keterangan: string;
  bukti: string; // nama berkas bukti di uploads/pengajuan/ (akses: GET /api/pengajuan/bukti/<bukti>)
  ditangani_oleh?: number | null;
  catatan_putusan?: string | null;
  dibuat_pada: string;
  peserta?: { id: number; nama: string };
}

/* ---------- QR absensi ---------- */
/** Token tayang dari POST /absensi/qr-saya (peserta). Isi QR = token ini. */
export interface TayanganQr {
  token: string;
  jenis: Jenis;
  berlaku_detik: number;
  kedaluwarsa_pada: string;
}

/** Hasil pindaian pembimbing (POST /absensi/scan; metode qr_wajah memverifikasi wajah peserta lebih dulu). */
export interface HasilScan {
  pesan: string;
  nama: string;
  jam: string;
  status: StatusAbsensi;
  metode: string;
}

/* ---------- Jurnal ---------- */
export type StatusJurnal = 'Draft' | 'Dikirim' | 'Revisi' | 'Disetujui';

export interface BarisJurnal {
  id: number;
  tanggal: string;
  judul: string;
  status: StatusJurnal;
}

/** Baris daftar jurnal peserta: gabungan tanggal absensi dan jurnal.
 * id null = baris dari tanggal absensi yang jurnalnya belum diisi. */
export interface BarisJurnalAbsensi extends BarisJurnal {
  absensi?: { masuk: string; status: string } | null;
}

export interface ReviewJurnal {
  id: number;
  jurnal_id: number;
  pembimbing_id: number;
  keputusan: 'Disetujui' | 'Revisi';
  catatan: string | null;
  pembimbing?: { id: number; nama: string } | null;
  dibuat_pada: string;
}

export interface JurnalDetail extends BarisJurnal {
  uraian: string;
  hasil: string | null;
  kendala: string | null;
  rencana: string | null;
  lampiran: string | null;
  dibuat_pada: string;
  diubah_pada: string;
  reviews: ReviewJurnal[];
  peserta?: { id: number; nama: string } | null;
}

/* ---------- Pembimbing (fase 5) ---------- */
export interface RingkasanPembimbing {
  jumlah_peserta: number;
  hadir_hari_ini: number;
  perlu_review: number;
}

export interface BarisPesertaPembimbing {
  id: number;
  nama: string;
  email: string;
  aktif: boolean;
  divisi: string | null;
  rekap_30_hari: Partial<Record<StatusAbsensi, number>>;
}

export interface BarisJurnalPembimbing extends BarisJurnal {
  peserta?: { id: number; nama: string } | null;
}

/* ---------- Admin (fase 5) ---------- */
export interface RingkasanAdmin {
  peserta_aktif: number;
  pembimbing_aktif: number;
  hadir_hari_ini: number;
  terlambat_hari_ini: number;
  grafik: { tanggal: string; status: 'Hadir' | 'Terlambat'; n: number }[];
}

export interface BarisAdminUser {
  id: number;
  nama: string;
  username: string;
  email: string;
  role: Role;
  aktif: boolean;
  foto_url: string | null;
  peserta?: ProfilPeserta | null;
  pembimbing_profil?: ProfilPembimbing | null;
}

export interface BarisAudit {
  id: number;
  user_id: number | null;
  pengguna: string;
  aksi: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  perangkat: string | null;
  dibuat_pada: string;
}

/* ---------- Laporan admin (rekap + jurnal per periode) ---------- */
export interface BarisRekapLaporan {
  id: number;
  nama: string;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  tidak_hadir: number;
  jurnal_disetujui: number;
  jurnal_dikirim: number;
  jurnal_revisi: number;
}

export interface LaporanData {
  absensi: (Absensi & { peserta?: { nama: string } })[];
  jurnal: (BarisJurnal & { peserta?: { nama: string } })[];
  rekap: BarisRekapLaporan[];
}
