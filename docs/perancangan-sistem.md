# Dokumen Perancangan Sistem
## Panel Absensi PKL dan Jurnal Kegiatan — Astakira Media

Dokumen ini merangkum rancangan sistem absensi PKL: arsitektur, keamanan, model data, alur pengguna, dan aturan bisnis yang menjadi dasar implementasi backend (`backend/`) maupun frontend (`frontend/`).

---

## 1. Pendahuluan

### 1.1 Tujuan Sistem
Sistem digunakan untuk mencatat kehadiran peserta PKL di Astakira Media secara terverifikasi (QR dan pengenalan wajah), memudahkan pembimbing memantau bimbingan dan meninjau jurnal kegiatan harian, serta memberi admin kendali atas pengguna, jadwal, koreksi absensi, laporan, dan jejak audit.

### 1.2 Peran Pengguna
| Peran | Tanggung jawab utama |
|---|---|
| **Peserta** | Absen masuk/pulang (QR + wajah), daftar/pemeriksaan wajah, riwayat absensi, menulis jurnal kegiatan harian, kelola profil. |
| **Pembimbing** | Menayangkan QR tayangan kepada bimbingan, dashboard ringkasan, daftar peserta bimbingan, review jurnal (setujui/revisi), rekap kehadiran, mencatat Izin/Sakit. |
| **Admin** | CRUD peserta & pembimbing, atur jadwal kerja (workshift), pengaturan mode absensi, koreksi absensi (wajib alasan), mencatat Izin/Sakit semua orang, laporan + ekspor CSV, jejak audit, reset template wajah. |

### 1.3 Prinsip Utama
1. **Server yang menentukan waktu**, status absensi, dan siapa yang menulis catatan absensi. Klien tidak pernah mengirim jam, tanggal, status, atau `user_id`.
2. **Kepemilikan data ditegakkan** di tiap endpoint: peserta hanya melihat miliknya, pembimbing hanya bimbingannya.
3. **Data biometrik selalu terenkripsi**: hanya embedding wajah terenkripsi AES-256-GCM yang disimpan; foto wajah tidak pernah disimpan dan tidak pernah dikirim ke klien.
4. **Rahasia hanya di `.env`**, tidak pernah masuk repositori atau log.
5. **Perubahan skema melalui migrasi Sequelize** (`backend/migrations/`), bukan `sync`.
6. **Setiap fitur memiliki tes otomatis** (Jest + Supertest, `NODE_ENV=test` mematikan rate limit).

---

## 2. Arsitektur dan Teknologi

### 2.1 Arsitektur Umum

```
┌─────────────────────────────┐        HTTP/JSON (Bearer JWT)
│  Frontend (Peserta Browser) │◄───────────────────────────────┐
│  React + Vite + TypeScript  │                                │
│  Tailwind 4, PWA, kamera    │                                │
│  MediaPipe Face Landmarker  │                                ▼
└─────────────────────────────┘                  ┌──────────────────────────┐
                                                 │   Backend API (Express)  │
┌─────────────────────────────┐                  │  http://…:4000/api       │
│  Frontend (Pembimbing)      │◄────────────────►│  auth → role → controller│
│  tayangkan QR berotasi      │                  │  service → model         │
└─────────────────────────────┘                  └────────────┬─────────────┘
                                                             │ Sequelize
                                              ┌──────────────▼─────────────┐
                                              │   MySQL (utf8mb4)          │
                                              │   face_templates (AES-GCM) │
                                              └────────────────────────────┘
```

**Arah alur QR — QR tayangan pembimbing (arah baru):** *pembimbing yang menayangkan QR*; QR berotasi otomatis tiap 30 detik; peserta memindai dengan HP sendiri lalu mengonfirmasi dengan wajah. Ini menggantikan arah lama (QR milik peserta dipindai pembimbing) yang masih tersisa pada mokap referensi di `docs/referensi-ui/`.

### 2.2 Teknologi
| Lapisan | Teknologi |
|---|---|
| Backend runtime | Node.js ≥ 18, Express 5 |
| Database | MySQL + Sequelize (mysql2), migrasi sequelize-cli |
| Autentikasi | JWT (jsonwebtoken, HS256), bcryptjs (cost 12) |
| Keamanan | Helmet (CSP/HSTS), CORS daftar origin, Morgan, express-rate-limit per route |
| Email | Nodemailer (tanpa SMTP → jsonTransport untuk dev) |
| Upload | Multer (memoryStorage, max 2 MB, validasi MIME + magic bytes) |
| Frontend | React + Vite + TypeScript, Tailwind 4, react-router 7 |
| Kamera wajah | MediaPipe Face Landmarker (model disajikan lokal di `frontend/public/wajah/`), embedding vektor 128 angka dihitung **di browser** |
| QR | `qrcode-generator` (render tayangan), `jsQR` (pemindai di HP peserta) |
| Uji | Jest + Supertest (`npm test --prefix backend`, `--runInBand`) |
| PWA | `manifest.webmanifest`, service worker (`frontend/public/sw.js`), banner luring |

### 2.3 Penempatan Frontend
Saat `SERVE_FRONTEND=true`, Express menyajikan hasil build `frontend/dist` (plus SPA fallback) di port yang sama dengan API; saat pengembangan, Vite proxy `/api` dan `/uploads` ke `localhost:4000`, dan HTTPS dev (`basic-ssl`) dipakai agar kamera HP berfungsi (akses kamera wajib konteks aman).

---

## 3. Keamanan

### 3.1 Autentikasi (JWT)
- Login menerima `identifier` (email **atau** username) + kata sandi; bcrypt dibandingkan dengan *dummy hash* bila pengguna tidak ada agar waktu respons seragam (*timing-equal*).
- Token: `HS256`, payload `{sub, role}`, masa berlaku `JWT_EXPIRES` (bawaan 8 jam).
- Middleware `auth` (backend/src/middleware/auth.js) mem-verifikasi token **dan memuat ulang pengguna dari DB pada setiap request**, sehingga akun yang baru dinonaktifkan langsung terblokir (401 `NONAKTIF`).
- Middleware `role('peserta'|'pembimbing'|'admin')` memfilter endpoint; pelanggaran → 403 `DILARANG`.
- Lupa sandi: token acak 32 byte, **hanya hash SHA-256 tersimpan**, TTL 30 menit, dikirim lewat email, respons tetap netral (tidak membocorkan keberadaan akun). Reset menerapkan aturan sandi sama (≥ 8, ≤ 72 karakter).
- Token klien disimpan di `sessionStorage` (`frontend/src/lib/api.ts`); 401 otomatis dialihkan ke `/login`.

### 3.2 Kepemilikan Data
- Pembimbing hanya dapat melihat baris `Peserta` dengan `pembimbing_id` miliknya.
- Peserta hanya dapat memindai QR tayangan **pembimbing pembimbingnya** (selain itu 403 `BUKAN_BIMBINGAN`).
- Jurnal hanya boleh diakses pemiliknya; review jurnal hanya oleh pembimbing pembimbing.

### 3.3 Data Wajah dan Biometrik
- Embedding (128 dimensi, dihitung browser) dienkripsi **AES-256-GCM** dengan `FACE_KEY` (64 hex), disimpan `face_templates.embedding` dalam format `iv.tag.ciphertext` (base64). Dekripsi hanya di memori server saat pembandingan.
- Pendaftaran wajah wajib menyertai `persetujuan: true` (dicatat `disetujui_pada`).
- Yang pernah dicatat ke audit hanyalah angka jarak Euclidian dua embedding (ambang `FACE_THRESHOLD`, bawaan 0.5). Foto/vektor tidak pernah disimpan, dikirim ke klien, atau muncul di log.
- Nonce liveness, token QR, dan token reset **hanya disimpan sebagai hash SHA-256**.
- Template wajah dihapus saat akun dinonaktifkan atau direset admin (`DELETE /api/admin/face/:id`).

### 3.4 Liveness (Mode A)
Server membuat tantangan sekali pakai: nonce + instruksi gerakan acak (`kedip`, `tengok_kiri`, `tengok_kanan`), TTL 60 detik, terikat `user_id`. Batasan mode ini diakui: jika penelepon API langsung mengakui gerakan secara eksplisit, mode ini bisa dikelabui; mitigasi berupa nonce sekali pakai, TTL pendek, rate limit, dan audit. Jalur upgrade ke mode B cukup mengganti `backend/src/services/liveness.js` tanpa mengubah alur lain.

### 3.5 Anti Penyalahgunaan Lain
- Rate limit per endpoint (contoh: login 10/15 mnt, absensi wajah 10/mnt, QR tayang 60/mnt; dimatikan saat test).
- `express.json` limit 100 KB; upload foto max 2 MB dengan validasi magic bytes (JPEG/PNG/WebP), nama file acak.
- Helmet: CSP penuh (mengizinkan `wasm-unsafe-eval` bagi MediaPipe; pustaka QR dibundel lokal), HSTS saat produksi, `frame-ancestors: 'none'`.
- CSV ekspor diberi BOM UTF-8 + mitigasi *formula injection* (awalan `='` untuk sel diawali `=+-@`).
- Kegagalan penulisan audit tidak menggagalkan request utama.

---

## 4. Model Data (Skema)

Semua model didefinisikan di `backend/src/models/index.js`; struktur tabel dibuat lewat migrasi (01–08). Konvensi: `timestamps: true` dengan kolom `dibuat_pada`/`diubah_pada`, zona UTC.

| Model / Tabel | Fungsi | Field & catatan penting |
|---|---|---|
| `users` | Akun login semua peran | `nama`, `username` (unik), `email` (unik), `password_hash`, `role` (peserta/pembimbing/admin), `foto_url`, `aktif`, `reset_token_hash`, `reset_expires` |
| `peserta` | Profil PKL peserta | `user_id` (unik), `divisi`, `pembimbing_id` (id User berperan pembimbing) |
| `pembimbing` | Profil pembimbing | `user_id` (unik), `divisi` |
| `workshift` | Jadwal kerja 7 hari | `hari` (Senin…Minggu, unik), `hari_kerja` bool, `jam_masuk`, `jam_pulang`, `toleransi_menit` (bawaan 15) |
| `face_templates` | Embedding wajah terenkripsi | `user_id` (unik), `embedding` (AES-256-GCM), `disetujui_pada` |
| `face_verifications` | Sesi verifikasi wajah | `jenis` (masuk/pulang), TTL `FACE_VERIFY_TTL_DETIK` (180 dtk), `dipakai_pada` |
| `qr_tokens` | QR tayangan peserta yang dipindai pembimbing | `token_hash` SHA-256 saja, `jenis`, kedaluwarsa; terikat jenis absen; diganti tiap `QR_TTL_DETIK` (30 dtk) |
| `absensi` | Catatan kehadiran | `user_id`, `tanggal`, `jenis` (masuk/pulang), `jam`, `status` (**Hadir, Terlambat, Izin, Sakit, Tidak hadir**), `metode` (`QR+Wajah`, `QR`, `Wajah`, `Otomatis`, atau `Izin`/`Sakit`), `keterangan`, `token_id`, `dikonfirmasi_oleh`. **Batas unik DB `uq_absensi_harian` (user_id, tanggal, jenis)** — menjaga maksimal 1 baris jenis masuk dan 1 pulang per hari |
| `absensi_penolakan` | Sisa alur QR lama | token ditolak/nolak; dipertahankan untuk histori |
| `pengaturan_absensi` | Baris tunggal id=1 | `metode` (`qr_wajah` bawaan, `qr`, `wajah`), `liveness_aktif` (bool); dibaca lewat cache 5 dtk |
| `tantangan_wajah` | Nonce liveness | `nonce_hash`, `kode_gerakan`, kedaluwarsa, sekali pakai |
| `jurnal` | Jurnal kegiatan harian | `judul`, `uraian`, `hasil`, `kendala`, `rencana`; `status` (**Draft, Dikirim, Revisi, Disetujui**). Unik harian per pengguna `uq_jurnal_harian` |
| `jurnal_review` | Review pembimbing | `keputusan` (Disetujui/Revisi), `catatan` |
| `audit_log` | Jejak audit | `user_id` (tanpa FK agar tetap ada walau akun dihapus), `aksi`, `target`, `detail` JSON `{lama, baru, alasan}`, `ip`, `perangkat` |

---

## 5. Alur Bisnis Inti

### 5.1 Penetapan Waktu oleh Server
- Waktu dihitung **di momen permintaan diterima** melalui fungsi `bagian()` pada `backend/src/utils/waktu.js` dengan `Intl.DateTimeFormat` di zona `TZ_APLIKASI` (bawaan `Asia/Jakarta`) — **bukan** zona server/perangkat.
- Klien hanya mengirim `jenis` (masuk/pulang), `embedding`, `nonce` liveness, dan token hasil pemindaian. Tanggal, jam, status, `user_id`, dan `dikonfirmasi_oleh` semuanya ditetapkan server.

### 5.2 Penentuan Status
`hitungStatus(jenis, workshift, waktu)`:
- Absen **masuk** → `Hadir` bila ≤ `jam_masuk + toleransi_menit`, selain itu `Terlambat`.
- Absen **pulang** → selalu `Hadir`.

### 5.3 Tiga Mode Absensi (Pengaturan Admin)
Mode disimpan di `pengaturan_absensi` (`qr_wajah` bawaan / `qr` / `wajah`) dan dibaca server saat verifikasi; jika mode tidak cocok → `MODE_QR_NONAKTIF` / `MODE_WAJAH_NONAKTIF`.

**A. QR + Wajah (bawaan, untuk absen masuk/pulang):**
1. Peserta menayangkan QR di layarnya (`POST /api/absensi/qr-saya`); token tayangan berotasi tiap `QR_TTL_DETIK` (30 dtk) dan dibuat server.
2. Pembimbing memindai QR dari HP-nya (`POST /api/absensi/scan`): jenis absensi mengikuti token milik peserta, bukan dikirim klien.
3. Server menulis absensi dan menandai token dipakai — dua pemindaian bersamaan gagal dengan 409 `QR_SUDAH_DIPAKAI` (penandaan token atomik).

**B. Langsung wajah (tanpa QR):** Peserta menekan tombol absen → `POST /api/absensi/wajah`: tantangan liveness + verifikasi embedding → absen ditulis. **Absen pulang selalu memakai jalur ini, tanpa QR** (`PULANG_WAJAH`).

**C. QR saja (tanpa wajah):** jika admin mematikan wajah; verifikasi embedding dilewati, sisanya sama.

### 5.4 Aturan Absensi Lain
| Aturan | Kode error |
|---|---|
| Sudah absen jenis tersebut hari itu (terdeteksi batas unik basis data) | `SUDAH_ABSEN` 409 |
| Hari bukan hari kerja sesuai `workshift` | `HARI_LIBUR` 422 |
| Hari sudah tercatat Izin/Sakit (slot harian terkunci) | `HARI_TERCATAT` 409 |
| Absen pulang **belum tercatat masuk** | `BELUM_ABSEN_MASUK` 422 |
| Absen pulang sebelum `jam_pulang − 5 menit` | `PULANG_BELUM_WAKTUNYA` 422 |
| Peserta belum mendaftar wajah | `TEMPLATE_BELUM` 412 |
| Wajah terbaca namun jarak embedding di atas ambang | `WAJAH_TIDAK_COCOK` 422 |

Detail lain (lihat backend/README untuk tabel kode lengkap): peserta memindai QR pembimbing yang tidak membimbingnya (`BUKAN_BIMBINGAN`), QR kedaluwarsa/sudah dipakai (`QR_KEDALUWARSA`/`QR_SUDAH_DIPAKAI`), tantangan liveness tidak ada/kedaluwarsa/sudah dipakai (`TANTANGAN_*`), template sudah ada (`TEMPLATE_ADA`), persetujuan wajib (`PERSETUJUAN_WAJIB`).

### 5.5 Izin/Sakit & Penutupan Hari
- Izin/Sakit **tidak dibuat sebagai baris kosong**: ditulis sebagai baris `jenis='masuk'` berstatus `Izin`/`Sakit` dengan `metode` = nama statusnya dan `keterangan` 3–1000 karakter, sehingga slot masuk harian **terkunci oleh batas unik DB**.
- Peserta/pembimbing dapat mengajukan untuk hari ini hingga 7 hari ke belakang (`JURNAL_MAKS_HARI_BELAKANG`), tidak boleh masa depan; pembimbing hanya untuk bimbingannya, admin untuk semua orang.
- **Penutupan hari (tutup-hari)**: pekerjaan interval 5 menit menjalankan idempoten `services/tutup-hari.js` — di hari kerja setelah `jam_pulang + TUTUP_HARI_MENIT` (bawaan 60), peserta aktif tanpa catatan apa pun diberi baris `Tidak hadir` (jam `00:00:00`, `metode='Otomatis'`).
- Pembersih harian menghapus token QR/verifikasi wajah/tantangan lama (> 24 jam setelah kedaluwarsa).

### 5.6 Jurnal Kegiatan
- Peserta membuat 1 jurnal per hari (batas unik harian), status `Draft` → kirim (`Dikirim`).
- Pembimbing meninjau: `setujui` → `Disetujui`, atau `revisi` → `Revisi` (dengan catatan); revisi dapat diedit peserta lalu dikirim ulang.
- Pembimbing hanya melihat jurnal bimbingannya; dashboard peserta/pembimbing menampilkan jumlah disetujui.

### 5.7 Laporan & Audit
- Admin: `GET /api/admin/laporan` (filter rentang, `?format=csv` untuk ekspor CSV dengan mitigasi formula injection).
- `GET /api/admin/audit` berhalaman (limit, halaman) menampilkan jejak: login gagal/berhasil, perubahan data, koreksi absensi `{lama, baru, alasan}`, reset wajah, dsb.

---

## 6. Antarmuka API

Semua diawali `/api`; `auth` = token JWT, `role` = filter peran. Ringkasan endpoint (detail lengkap di `backend/src/routes/index.js`).

### 6.1 Publik
| Method & Path | Catatan |
|---|---|
| GET `/api/health` | tanpa auth |
| POST `/api/auth/login` | rate 10/15 mnt |
| POST `/api/auth/lupa-password` | rate 5/15 mnt |
| POST `/api/auth/reset-password` | rate 10/15 mnt |

### 6.2 Semua Peran (Login)
Auth me (`/api/auth/me`), ganti sandi (`PUT /api/profil/password`), foto profil (`POST /api/profil/foto`), baca jadwal (`GET /api/workshift`), baca pengaturan absensi (`GET /api/pengaturan/absensi`; perubahan hanya oleh admin).

### 6.3 Peserta
- Wajah: cek terdaftar (`GET /api/face/template`, respons hanya boolean `terdaftar` tanpa data biometrik), mendaftar (`POST /api/face/enroll`, wajib persetujuan), tantangan liveness (`POST /api/face/tantangan`), verifikasi (`POST /api/face/verify`, TTL sesi 180 dtk).
- Absensi: konfirmasi scan (`konfirmasi-scan`), absen wajah (`/api/absensi/wajah`, dipakai untuk masuk mode langsung maupun **seluruh absen pulang**), riwayat (`GET /api/absensi/riwayat?dari&sampai`, limit 366).
- Jurnal: list/buat (`GET/POST /api/jurnal`), detail/ubah (`GET/PUT /api/jurnal/:id`, `aksi:"kirim"` untuk mengirim).

### 6.4 Pembimbing
- `POST /api/absensi/qr-tayang` — QR tayangan berotasi (rate 60/mnt).
- Dashboard & peserta: `/api/pembimbing/ringkasan`, `/peserta`, `/rekap`.
- Jurnal: `/api/pembimbing/jurnal`, detail, review (`{keputusan: "setujui"|"revisi", catatan}`).
- Ketidakhadiran: `POST /api/pembimbing/keterangan` (Izin/Sakit bimbingan).

### 6.5 Admin
- CRUD `/api/admin/peserta` dan `/api/admin/pembimbing` (pabrik CRUD yang sama).
- `PUT /api/admin/workshift` — simpan 7 hari sekaligus.
- `GET /api/admin/ringkasan` — statistik peserta aktif, hadir hari ini, grafik 7 hari.
- Absensi: daftar baris (`GET /api/admin/absensi?user_id&tanggal`), keterangan (`POST /api/admin/absensi/keterangan`), koreksi (`PUT /api/admin/absensi/:id` — **wajib `alasan`**, masuk audit).
- Laporan & audit: `GET /api/admin/laporan[?format=csv]`, `GET /api/admin/audit`.
- Reset biometrik: `DELETE /api/admin/face/:id`.

### 6.6 Format Error
Setiap error `{ pesan, kode }` (middleware `error.js`). Kode umum: `VALIDASI`, `RATE_LIMIT`, `KREDENSIAL`, `NONAKTIF`, `DILARANG`, `BELUM_LOGIN`/`SESI_HABIS`, `TOKEN_RESET`, `TIDAK_ADA`, `UPLOAD`, `DUPLIKAT`, `SERVER`. Seluruh tabel kode bisnis (QR/wajah/absensi/jurnal/persetujuan) dipelihara di `backend/README.md` dan dipetakan ke pesan UI di `frontend/src/lib/petaKode.ts`.

---

## 7. Frontend (Pengalaman Pengguna)

### 7.1 Prinsip
- Berbahasa Indonesia; responsif dari layar 360 px sampai desktop (sidebar desktop, drawer HP).
- Aksesibel: label terkait, fokus terlihat, kontras memadai.
- PWA: dapat dipasang, banner luring — tindakan absen/jurnal diblokir saat offline (tidak boleh ada antrean palsu absensi).
- Error API ditampilkan menggunakan pesan hasil pemetaan `petaKode.ts` (bukan kode mentah).

### 7.2 Struktur Rute
| Peran | Halaman |
|---|---|
| Publik | `/login`, `/lupa-sandi`, `/reset-password` |
| Peserta | Beranda, `/absensi` (absen masuk/pulang), `/absensi/scan` (pindai QR pembimbing), `/wajah/daftar`, `/wajah/periksa`, `/riwayat`, `/jurnal` (list/buat/detail/ubah), `/profil` |
| Pembimbing | Dashboard ringkasan, `/pembimbing/scan` (tayangkan QR), `/pembimbing/peserta`, `/pembimbing/jurnal` (+ detail review), `/pembimbing/rekap`, `/pembimbing/izin` |
| Admin | Dashboard, `/admin/peserta`, `/admin/pembimbing`, `/admin/jadwal`, `/admin/absensi` (koreksi), `/pengaturan`, `/admin/audit` |

- `Shell` menyediakan header/sidebar per peran + GuardPeran; `konteks/Auth.tsx` mengelola sesi.
- `lib/wajah.ts` membungkus MediaPipe: aktivasi kamera, ekstraksi embedding, menjalankan liveness dari server.
- `docs/referensi-ui/` dan `dashboard-siswa-demo.html` adalah mokap referensi sebelum implementasi (kode mokap masih mencerminkan arah QR lama; implementasi yang aktif memakai tayangan pembimbing).

---

## 8. Konfigurasi Lingkungan

Dari `backend/.env.example` (divalidasi ketat di `config/env.js`; wajib terisi: `JWT_SECRET` ≥ 32 karakter, `FACE_KEY` 64 hex, `DB_NAME`, `DB_USER`).

| Variabel | Bawaan | Keterangan |
|---|---|---|
| `NODE_ENV` / `PORT` | — / `4000` | mode aplikasi dan port API |
| `TZ_APLIKASI` | `Asia/Jakarta` | zona waktu penetapan absensi (server-side) |
| `TRUST_PROXY` | — | wajib `true` di belakang reverse proxy |
| `DB_HOST/PORT/NAME/USER/PASS` | — | basis data MySQL (utf8mb4) |
| `DB_SYNC` | `false` | hanya `true` untuk dev awal; produksi wajib migrasi |
| `JWT_SECRET`, `JWT_EXPIRES` | — / `8h` | rahasia tanda tangan token |
| `FACE_KEY`, `FACE_THRESHOLD`, `FACE_DIM` | — / 0,5 / 128 | kunci enc AES-256-GCM, ambang pembandingan wajah, dimensi embedding |
| `FACE_VERIFY_TTL_DETIK`, `LIVENESS_TTL_DETIK` | 180 / 60 | masa berlaku sesi verifikasi & tantangan |
| `QR_TTL_DETIK` | 30 | rotasi QR tayangan peserta |
| `CORS_ORIGIN`, `FRONTEND_URL` | — | daftar origin (dipisah koma) |
| `SMTP_*`, `MAIL_FROM` | — | Nodemailer; tanpa host → jsonTransport |
| `TUTUP_HARI_MENIT` | 60 | jeda setelah jam pulang untuk menandai Tidak hadir |
| `SERVE_FRONTEND` | — | bagian Express menyajikan frontend hasil build |
| `JURNAL_MAKS_HARI_BELAKANG` | 7 | pencatatan maks. ke belakang (Izin/Sakit/sandi jurnal) |

**Persiapan awal:** buat DB `absensi_pkl CHARACTER SET utf8mb4` → salin `.env.example` → `npm run db:migrate` → `npm run seed` (butuh `SEED_PASSWORD`; idempoten: 1 admin, 2 pembimbing, 4 peserta termasuk 1 nonaktif, jadwal Sen–Jum masuk 08:00 pulang 16:00/Jum 15:30 toleransi 15 menit) → `npm run dev` (API di `:4000`).

---

## 9. Pengujian dan Verifikasi
- `npm test` (backend) — Jest + Supertest, `--runInBand`; cakupan: auth, penjaga peran, alur absensi ketiga mode, enrol/verifikasi wajah, jurnal, izin/sakit, koreksi admin, CRUD admin, unggah, pembersih, penutupan hari (± 114 kasus).
- Rate limit otomatis dimatikan saat `NODE_ENV=test`.
- Verifikasi manual opsional dengan `backend/requests.http` untuk alur ber-kamera (wajah/QR).
- Sebelum fitur dinyatakan selesai: jalankan penuh `npm test` di `backend/`.

---

## 10. Rancangan Penerapan (Ringkas)
- Produksi: `NODE_ENV=production`, `SERVE_FRONTEND=true` (menyajikan hasil build frontend), `DB_SYNC=false`, `TRUST_PROXY=true`.
- Kamera wajah: frontend harus disajikan lewat HTTPS.
- Backup basis data: `mysqldump` (`backend/scripts/pulihkan-db.js` untuk pemulihan).
- Catatan: **tidak ada geolokasi/GPS** di sistem ini; satu-satunya perhitungan "jarak" adalah jarak Euclidian dua embedding wajah.

## 11. Batasan yang Dicatat Rancangan
1. **Liveness mode A** dapat dikelabui penelepon API langsung yang mengakui gerakan eksplisit — mitigasi: nonce, TTL pendek, rate limit, audit; upgrade jalur "mode B" terisolasikan di `services/liveness.js`.
2. Ekspor laporan saat ini baru CSV (Excel/PDF belum).
3. `dashboard-siswa-demo.html` dan `docs/referensi-ui/index.html` adalah mokap referensi dan tidak dipakai sejak runtime; mokap masih menggambarkan arah QR lama (QR milik peserta), sedangkan implementasi berjalan memakai tayangan pembimbing.
