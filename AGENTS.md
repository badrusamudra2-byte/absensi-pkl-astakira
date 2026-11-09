# Proyek
Panel Absensi PKL dan Jurnal Kegiatan, Astakira Media. Peran: peserta, pembimbing, admin. Web responsif (desktop dan HP), berbahasa Indonesia.

# Stack
Backend: Node.js (>= 18), Express, Sequelize + mysql2, MySQL, JWT (jsonwebtoken), bcryptjs, Nodemailer, Multer, Helmet, CORS, Morgan, express-rate-limit, dotenv (folder backend/).
Frontend: React, Vite, TypeScript, Tailwind (folder frontend/, dibuat di fase 1). frontend/index.html saat ini hanya demo tampilan dengan data contoh di browser, belum tersambung ke API.

# Perintah
Semua dijalankan dari folder `backend/` (frontend belum punya package.json):

| Tujuan | Perintah |
|---|---|
| Install dependensi | `npm install` |
| Development (auto-reload) | `npm run dev` (`node --watch src/server.js`, API di http://localhost:4000/api) |
| Production start | `npm start` |
| Seed data awal | `npm run seed` (tabel dibuat via `sequelize.sync()`, butuh `SEED_PASSWORD` di .env) |

- Belum ada script `test` dan `lint` di backend/package.json. Tes otomatis dan linter ditambahkan di fase berikutnya; sampai keduanya ada, verifikasi manual dengan `backend/requests.http`.
- Belum ada `sequelize-cli`/migrasi; `DB_SYNC=true` hanya untuk development awal.
- Membuat database lebih dulu: `CREATE DATABASE absensi_pkl CHARACTER SET utf8mb4;` lalu isi `.env` (JWT_SECRET >= 32 karakter, FACE_KEY 64 hex, DB_USER/DB_PASS, SEED_PASSWORD) dari `.env.example`.

# Aturan wajib
1. Server yang menentukan waktu, status absensi, dan siapa yang menulis absensi. Jangan pernah menerima jam, status, atau user_id absensi dari klien.
2. Tiap endpoint: cek peran lewat middleware (`auth` + `role`, lihat backend/src/middleware/auth.js), cek kepemilikan data (peserta hanya miliknya, pembimbing hanya bimbingannya), validasi input.
3. Error API berbentuk { pesan, kode }. Kode baru wajib masuk tabel di backend/README.md dan dipetakan ke pesan UI.
4. Data wajah: hanya embedding terenkripsi (AES-256-GCM, tabel face_templates), tidak pernah dikirim ke klien, tidak muncul di log.
5. Rahasia hanya di .env. Jangan commit .env dan jangan cetak token atau kata sandi ke log.
6. Perubahan skema lewat migrasi Sequelize, bukan sync. (Saat ini sync masih dipakai di server.js dan seed.js karena migrasi belum ada — berhenti memakai sync begitu sequelize-cli terpasang.)
7. Tiap fitur baru punya tes otomatis. Jalankan tes sebelum menyatakan selesai. (Kerangka tes belum ada; pasang saat fitur pertama fase berikutnya.)
8. Teks UI Bahasa Indonesia. Tampilan nyaman di layar 360px dan desktop, aksesibel (label, fokus terlihat, kontras cukup).
9. Satu fase per sesi. Jangan mengubah di luar lingkup tugas. Jika perlu, tanyakan dulu.

# Cara kerja
Mulai dengan rencana (file yang diubah dan alasannya), tunggu persetujuan, kerjakan langkah kecil, jalankan tes, lalu ringkas hasil dan hal yang belum selesai.
