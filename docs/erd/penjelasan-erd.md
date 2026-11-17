# Penjelasan ERD — Basis Data Aplikasi Absensi PKL dan Jurnal Kegiatan (Astakira Media)

> Bahan untuk laporan proyek akhir, BAB IV bagian 4.2.1 Perancangan Basis Data.
> Skema diperiksa langsung dari database MySQL (`information_schema`), model Sequelize
> (`backend/src/models/index.js`), dan berkas migrasi (`backend/migrations/`).

## Gambaran umum

Basis data aplikasi memakai tujuh tabel utama yang saling terhubung melalui tabel induk
`users`. Seluruh akun (peserta, pembimbing, dan admin) disimpan dalam satu tabel `users`
dan dibedakan oleh kolom `role`, sedangkan data khusus per peran disimpan pada tabel
`peserta` dan `pembimbing`. Aktivitas harian (absensi, pengajuan izin/sakit, jurnal, dan
review jurnal) semuanya merujuk pada tabel `users` melalui kolom kunci penghubung
(foreign key) `user_id`.

## Relasi antartabel

| No | Relasi | Kardinalitas | Kunci penghubung | Keterangan |
|----|--------|--------------|------------------|------------|
| 1 | `users` – `peserta` | 1 : 1 | `peserta.user_id` → `users.id` | Satu akun peserta memiliki tepat satu profil peserta (kolom `user_id` bernilai unik). |
| 2 | `users` – `pembimbing` | 1 : 1 | `pembimbing.user_id` → `users.id` | Satu akun pembimbing memiliki tepat satu profil pembimbing (kolom `user_id` bernilai unik). |
| 3 | `users` – `peserta` (relasi bimbingan) | 1 : N | `peserta.pembimbing_id` → `users.id` | Satu pembimbing membimbing banyak peserta. Nilai `pembimbing_id` adalah id user ber-role pembimbing; boleh kosong (NULL) saat peserta belum ditugaskan. |
| 4 | `users` – `absensi` | 1 : N | `absensi.user_id` → `users.id` | Satu peserta memiliki banyak baris absensi; indeks unik `(user_id, tanggal)` menjamin maksimal satu baris absensi per peserta per hari (data absen masuk dan pulang disimpan pada baris yang sama melalui kolom `pulang_jam` dan `pulang_status`). |
| 5 | `users` – `absensi` (konfirmasi) | 1 : N (opsional) | `absensi.dikonfirmasi_oleh` → `users.id` | Mencatat pembimbing yang memindai QR peserta; bernilai NULL bila absensi tercatat tanpa konfirmasi pembimbing. |
| 6 | `users` – `pengajuan_izin` (pengaju) | 1 : N | `pengajuan_izin.user_id` → `users.id` | Satu peserta dapat mengajukan banyak izin/sakit. |
| 7 | `users` – `pengajuan_izin` (pemutus) | 1 : N (opsional) | `pengajuan_izin.ditangani_oleh` → `users.id` | Mencatat pembimbing yang memutuskan pengajuan; NULL selama status masih "Menunggu". |
| 8 | `users` – `jurnal` | 1 : N | `jurnal.user_id` → `users.id` | Satu peserta menulis banyak jurnal; indeks unik `(user_id, tanggal)` menjamin satu jurnal per peserta per hari. |
| 9 | `jurnal` – `jurnal_review` | 1 : N | `jurnal_review.jurnal_id` → `jurnal.id` | Satu jurnal dapat direview berkali-kali (disetujui atau diminta revisi) oleh pembimbing. |
| 10 | `users` – `jurnal_review` | 1 : N (opsional) | `jurnal_review.pembimbing_id` → `users.id` | Mencatat pembimbing yang melakukan review. |

## Catatan penting untuk laporan

1. **Kunci penghubung ditegakkan di level aplikasi.** Database MySQL tidak memuat
   FOREIGN KEY constraint; integritas relasi dijaga oleh asosiasi model Sequelize,
   indeks unik (`uq_absensi_harian`, `uq_jurnal_harian`, `user_id` unik pada tabel
   profil), dan penggunaan transaksi pada operasi yang menulis beberapa tabel sekaligus.
2. **Kolom `absensi.token_id`** merujuk ke tabel `qr_tokens` (tabel pendukung metode
   absensi QR) yang tidak digambar pada diagram ini karena laporan berfokus pada tujuh
   tabel utama.
3. **Kolom rahasia** pada `users` (`password_hash`, `reset_token_hash`, `reset_expires`)
   tidak pernah dikembalikan oleh API; scope bawaan model menyembunyikannya dari seluruh
   query biasa.
4. Data absen masuk dan absen pulang disimpan dalam **satu baris** tabel `absensi`
   (kolom `pulang_jam`, `pulang_status`) — bukan dua baris terpisah — sehingga kardinalitas
   `users` : `absensi` tetap 1 : N dengan satu baris per hari per peserta.
