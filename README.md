# Panel Absensi PKL & Jurnal Kegiatan - Astakira Media

```
astakira-absensi-pkl/
  backend/     API Express.js + Sequelize (MySQL). Panduan lengkap: backend/README.md
  frontend/    Aplikasi React (Vite + TypeScript + Tailwind + react-router), tersambung ke API; PWA
  docs/        referensi-ui/index.html — acuan tampilan (tema biru dan putih) dari desain awal
  .vscode/     pengaturan, debug (F5), dan task untuk VS Code
```

## Menjalankan dari nol

1. **Database (sekali saja).** MySQL berjalan lalu jalankan
   ```sql
   CREATE DATABASE absensi_pkl CHARACTER SET utf8mb4;
   ```
2. **Backend.** Terminal di folder `backend/`:
   ```bash
   npm install
   copy .env.example .env   # lalu isi: JWT_SECRET (min 32), FACE_KEY (64 hex), DB_USER/DB_PASS, SEED_PASSWORD
   npm run db:migrate       # membuat semua tabel lewat migrasi
   npm run seed             # data awal: admin, 2 pembimbing, 4 peserta, jadwal
   npm run dev              # API di http://localhost:4000/api
   ```
   Buat FACE_KEY: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   Tes: `npm test` (memakai database `DB_NAME_TEST`, dibuat otomatis).
3. **Frontend.** Terminal kedua di folder `frontend/`:
   ```bash
   npm install
   npm run dev      # http://localhost:5173 (proxy /api dan /uploads ke backend)
   ```
4. **Masuk.** Buka http://localhost:5173. Login contoh (kata sandi `SEED_PASSWORD`):
   - Peserta: `samudra@astakira.id`, `aldi@astakira.id`, `bima@astakira.id`
   - Pembimbing: `mahesa@astakira.id` (Desain Grafis), `rahardi@astakira.id` (Konten Kreatif)
   - Admin: `admin@astakira.id`
   Setiap peran hanya melihat menunya sendiri.

## Fitur

- Login/lupa kata sandi, profil (foto + sandi), pendaftaran dan verifikasi wajah (liveness).
- Absensi masuk/pulang: QR (diterbitkan server) dan/atau wajah, izin/sakit oleh pembimbing.
- Jurnal harian dengan alur kirim → review pembimbing → revisi/disetujui.
- Rekap periode, koreksi admin berjejak audit log, pengaturan metode absensi.
- PWA (bisa dipasang di HP), banner luring: aksi absen/jurnal diblokir saat offline.
- Tes otomatis backend (Jest, 114 kasus) dan build frontend (tsc + vite).

## Deployment produksi

1. **Build frontend**, lalu biarkan backend menyajikannya dari origin yang sama (CSP penuh):
   ```bash
   cd frontend && npm run build
   ```
   Set di backend `.env`:
   ```
   NODE_ENV=production
   SERVE_FRONTEND=true
   DB_SYNC=false
   ```
   Jika memakai reverse proxy (Nginx/Cloudflare), set `TRUST_PROXY=true` dan jalankan
   HTTPS di proxy (helmet mengirim HSTS saat produksi). Alokakan memori Node bila perlu.
2. **Email sungguhan.** Isi `SMTP_HOST/PORT/USER/PASS` (mis. Mailtrap/vendor SMTP); tanpa
   SMTP, email reset hanya dicatat sebagai penerima-subjek di konsol (isi tak pernah di-log).
3. **Backup MySQL** (contoh harian, simpan hasilnya luar server):
   ```bash
   mysqldump --single-transaction --routines -u root -p absensi_pkl > backup-absensi-%date%.sql
   ```
   Pemulihan: `backend/scripts/pulihkan-db.js <berkas.sql>` (lihat jalannya di `backend/README.md`).

## Status

- Backend: lengkap sesuai alur (auth, absensi QR/wajah/izin, jurnal, laporan, audit, pengaturan),
  dengan migrasi, job penutup hari + pembersih token, hardening (CSP, validasi isi unggahan).
- Frontend: semua fitur tersambung ke API; PWA + penanganan luring; siap deploy via SERVE_FRONTEND.
