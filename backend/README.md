# Backend Panel Absensi PKL & Jurnal Kegiatan - Astakira Media

Express.js, Sequelize (MySQL), JWT, Nodemailer, Multer, Helmet, CORS, Morgan.

## Menjalankan

```bash
npm install
cp .env.example .env     # isi JWT_SECRET, FACE_KEY, kredensial DB, SEED_PASSWORD
npm run db:migrate       # membuat semua tabel (migrations/)
npm run seed             # data awal: admin, 2 pembimbing, 4 peserta, jadwal
npm run dev              # http://localhost:4000/api
```

Buat database kosong lebih dulu: `CREATE DATABASE absensi_pkl CHARACTER SET utf8mb4;`
Buat `FACE_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Akun seed: admin@astakira.id, mahesa@astakira.id, rahardi@astakira.id, samudra@astakira.id,
aldi@astakira.id (dan lainnya), kata sandi sesuai `SEED_PASSWORD`.

## Migrasi database

Tabel dibuat lewat `npm run db:migrate` (folder `migrations/`), bukan `sequelize.sync()`.
`DB_SYNC=true` di `.env` hanya untuk development awal â€” server akan memakai `sync()` saat itu saja.
Skrip terkait:

- `npm run db:migrate` â€” jalankan migrasi yang belum diterapkan
- `npm run db:migrate:undo` â€” batalkan semua migrasi (`db:migrate:undo:all`)
- `npx sequelize-cli migration:generate --name <nama>` â€” buat berkas migrasi baru

## Tes otomatis (Jest + supertest)

```bash
npm test
```

- Tes memakai database terpisah lewat `DB_NAME_TEST` (default `absensi_pkl_test`),
  dibuat otomatis beserta migrasinya oleh `tests/global-setup.js`.
- Lingkup saat ini: login (berhasil/salah sandi/akun nonaktif), lupa & reset kata sandi, penjaga peran
  (peserta/pembimbing memanggil endpoint admin harus 403), absensi QR (peserta menayangkan QR-nya,
  pembimbing memindai: hari libur, kedaluwarsa, dipakai ulang, dua pindaian bersamaan, QR tiap siswa
  berbeda, wajah+liveness), wajah & liveness (kecocokan, tantangan
  kedaluwarsa/dipakai ulang/milik user lain, tiga metode absensi, pembersihan data wajah saat akun
  dinonaktifkan), dan jurnal (siklus Draft/Dikirim/Revisi/Disetujui, transisi tidak valid, akses
  jurnal milik orang lain, validasi tanggal dan batas teks, batas unik harian).
- Rate limit route login (10/15 menit) cukup longgar untuk jumlah percobaan tes (dan dimatikan saat
  `NODE_ENV=test`).

## Alur absensi

Pengaturan metode absensi ada di tabel `pengaturan_absensi` (baris tunggal, diubah admin via
`GET/PUT /api/pengaturan/absensi`, masuk audit log): `metode` = `qr_wajah` (bawaan) | `qr` | `wajah`,
dan `liveness_aktif` (tantangan gerakan kedip/tengok/buka mulut dari server).

Arah QR: **peserta menayangkan QR berotasi 30 detik dari HP-nya sendiri, pembimbing memindainya**
(`POST /api/absensi/qr-saya` untuk peserta, `POST /api/absensi/scan` untuk pembimbing). Isi QR adalah
token acak (disimpan sebagai hash SHA-256, tabel `qr_tokens`, satu token milik satu peserta untuk satu
jenis absen) sehingga QR tiap siswa selalu berbeda satu sama lain; menayangkan QR baru otomatis
memadamkan token sebelumnya untuk jenis itu. Jenis absen (masuk/pulang) mengikuti token, bukan isi
body. Server yang menentukan waktu, status, dan `dikonfirmasi_oleh` (id pembimbing pemindai) saat
pindaian diterima — bukan dari klien. Pembimbing mana pun aktif boleh memindai; QR milik peserta
nonaktif ditolak.

### Mode qr_wajah (bawaan)
Wajah diverifikasi **oleh siswa sendiri di HP siswa**; pembimbing hanya memindai QR.
1. Peserta daftar wajah dahulu bila belum (`POST /api/face/enroll`).
2. `POST /api/face/tantangan` (peserta) — nonce sekali pakai + instruksi gerakan acak (`LIVENESS_TTL_DETIK`, 60 detik). Dilewati bila `liveness_aktif=false`.
3. `POST /api/face/verify` (peserta) `{ jenis, embedding, nonce?, foto? }` — embedding dibandingkan template terenkripsi miliknya; bila cocok, verifikasi tercatat berlaku `FACE_VERIFY_TTL_DETIK` (180 detik). Foto wajah (JPEG base64 ≤ `FACE_FOTO_MAKS_BAIT`) bila dikirim: divalidasi, dienkripsi AES-256-GCM, disimpan pada verifikasi.
4. `POST /api/absensi/qr-saya` (peserta) `{ jenis }` — menayangkan QR; token berlaku `QR_TTL_DETIK` (30 detik).
5. `POST /api/absensi/scan` (pembimbing) `{ token }` — absensi tercatat metode `QR+Wajah` bila peserta punya verifikasi wajah yang masih berlaku untuk jenis yang sama (sekali pakai). Foto ikut dipindahkan ke absensi (tabel `wajah_foto`) dan bisa dilihat admin lewat `GET /api/admin/absensi/:id/foto` (dibuka balik sebagai JPEG, masuk audit log, dihapus otomatis setelah `FACE_FOTO_RETENSI_HARI`).

### Mode qr
Langkah 2–3 dilewati; `scan` cukup `{ token }`, metode tersimpan `QR`.

### Mode wajah
Tanpa QR: `POST /api/absensi/wajah` `{ jenis, embedding, nonce?, foto? }` menulis absensi langsung setelah
embedding cocok dan (bila liveness aktif) tantangan terpenuhi. Metode absensi tersimpan `Wajah`;
foto wajah bila disertakan juga terikat ke absensi. Waktu tetap ditentukan server. Dalam mode ini
`qr-saya` dan `scan` ditolak (`MODE_QR_NONAKTIF`).

Jam dan status (Hadir/Terlambat) dihitung server dari momen `scan` diterima (mode qr/qr_wajah) atau
saat panggilan `/absensi/wajah`, memakai zona `TZ_APLIKASI`. Baik absen masuk maupun pulang dilakukan
lewat scan QR; absen pulang dibuka 5 menit sebelum jam pulang dan wajib absen masuk terlebih dulu.

## Izin, sakit, dan penutup hari

- **Pengajuan Izin/Sakit kini diberikan oleh peserta** (`POST /api/pengajuan/izin`, multipart):
  fields `jenis: "Izin"|"Sakit"`, `tanggal` (`YYYY-MM-DD`, default hari ini; boleh
  `PENGAJUAN_MAKS_HARI_MAJU` hari ke depan (default 1 = besok), maksimal
  `JURNAL_MAKS_HARI_BELAKANG` hari ke belakang), `keterangan` (3â€“1000 karakter) dan
  `bukti` (foto JPG/PNG/WebP maks 5 MB, disimpan acak di `uploads/pengajuan/`).
- Pembimbing melihat pengajuan bimbingannya (`GET /api/pengajuan/izin`), memutuskan lewat
  `PUT /api/pengajuan/izin/:id/putuskan` (`{ putusan: "Disetujui"|"Ditolak", alasan }` â€” alasan
  wajib saat Ditolak). Bila Disetujui, baris absensi Izin/Sakit dibuat di transaksi yang sama
  (slot masuk hari itu terkunci, QR/wajah menolak dengan `HARI_TERCATAT`).
- Peserta mengambil daftar miliknya lewat `GET /api/pengajuan/izin`; pembimbing cek
  `GET /api/pengajuan/notifikasi` (ada pengajuan Menunggu hari ini -> `{ ada: true }`,
  dipakai untuk lingkaran merah di menu).
- Desain memakai batas unik yang sudah ada (`uq_absensi_harian`: user+tanggal+jenis): Izin/Sakit
  ditulis sebagai baris `jenis='masuk'` berstatus Izin/Sakit (metode = statusnya). Satu slot masuk
  per hari berarti catatan mencegah QR maupun absensi wajah di hari itu (`HARI_TERCATAT`), dan dua
  catatan untuk tanggal sama terlarang database (`CATATAN_ADA`). Pengajuan ganda (tanggal sama,
  status bukan Ditolak) ditolak juga dengan `CATATAN_ADA`.
- **Penutup hari** (`src/services/tutup-hari.js`, job tiap 5 menit via `src/services/jobs.js`, manual
  `npm run tutup-hari [tanggal]`): pada hari kerja, setelah `jam_pulang + TUTUP_HARI_MENIT` (default 60),
  peserta aktif tanpa catatan absensi apa pun hari itu diberi baris `Tidak hadir` (metode `Otomatis`).
  Idempotent â€” baris yang sudah ada dilewati; hari libur dan tanggal masa depan tidak diproses.
- **Koreksi absensi** (`PUT /api/admin/absensi/:id`): admin mengubah jam/status/jenis, `alasan` wajib.
  Nilai lama, baru, dan alasan disimpan sebagai JSON di `audit_log.detail`.

## Jurnal kegiatan

- Peserta memilih tanggal (`YYYY-MM-DD`): tidak boleh masa depan, maksimal
  `JURNAL_MAKS_HARI_BELAKANG` (default 7) hari ke belakang.
- Batas keras satu jurnal per peserta per tanggal (`uq_jurnal_harian`); bentrok -> 409 `JURNAL_ADA`.
- Siklus status: Draft -> Dikirim -> (Revisi -> Dikirim | Disetujui). Hanya Draft/Revisi yang boleh
  diedit; memakai `aksi: "kirim"` untuk mengirim / mengirim ulang.
- Batas panjang: judul 150, uraian/hasil/kendala/rencana 5000 karakter.

## Kode error -> pesan UI

| kode | HTTP | Tampilan di frontend |
|---|---|---|
| QR_TIDAK_VALID | 404 | QR tidak valid |
| QR_KEDALUWARSA | 410 | QR kedaluwarsa |
| QR_SUDAH_DIPAKAI | 409 | QR sudah dipakai |
| SUDAH_ABSEN | 409 | Sudah absen hari ini |
| WAJAH_TIDAK_TERBACA | 422 | Wajah tidak terbaca |
| WAJAH_TIDAK_COCOK | 422 | Wajah tidak cocok |
| WAJAH_BELUM_VERIF | 422 | Peserta belum verifikasi wajah (atau verifikasi kedaluwarsa/terpakai) |
| FOTO_BUKAN_JPEG | 422 | Foto wajah bukan JPEG |
| FOTO_TERLALU_BESAR | 422 | Foto wajah melebihi batas ukuran |
| FOTO_ABSEN_TAK_ADA | 404 | Absensi tidak punya foto wajah |
| PERSETUJUAN_WAJIB | 422 | Persetujuan penggunaan data wajah dibutuhkan |
| TEMPLATE_ADA | 409 | Template wajah sudah terdaftar |
| TEMPLATE_BELUM | 412 | Template wajah belum terdaftar |
| TANTANGAN_WAJIB | 422 | Hasil tantangan liveness belum dikirim |
| TANTANGAN_TAK_ADA | 404 | Tantangan tidak dikenali |
| TANTANGAN_KEDALUWARSA | 410 | Tantangan kedaluwarsa |
| TANTANGAN_SUDAH | 409 | Tantangan sudah dipakai |
| MODE_QR_NONAKTIF | 409 | Metode absensi saat ini tidak memakai QR |
| MODE_WAJAH_NONAKTIF | 409 | Metode absensi saat ini tidak memakai wajah langsung |
| JURNAL_ADA | 409 | Sudah ada jurnal untuk tanggal itu |
| STATUS_TIDAK_VALID | 409 | Jurnal berstatus Dikirim/Disetujui tidak bisa diubah |
| BELUM_ABSEN_MASUK | 422 | Belum absen masuk |
| PULANG_BELUM_WAKTUNYA | 422 | Absen pulang dibuka 5 menit sebelum jam pulang |
| HARI_LIBUR | 422 | Hari ini bukan hari kerja |
| HARI_TERCATAT | 409 | Hari ini tercatat Izin/Sakit â€” absensi tidak diperlukan |
| CATATAN_ADA | 409 | Catatan izin/sakit untuk tanggal itu sudah ada |
| BUKTI_WAJIB | 400 | Lampirkan bukti pengajuan izin/sakit terlebih dulu |
| UPLOAD | 400 | Format bukti/foto tidak didukung (JPG, PNG, atau WebP) |
| TIDAK_ADA | 404 | Data tidak ditemukan / sudah diputuskan |
| BUKAN_BIMBINGAN | 403 | Pengajuan bukan dari peserta bimbingan Anda |
| ALASAN_WAJIB | 400 | Tulis alasan koreksi |
| PUNYA_RIWAYAT | 409 | Data punya riwayat, hanya bisa dinonaktifkan |

Semua error berbentuk `{ "pesan": "...", "kode": "..." }`. Semua endpoint ada di `src/routes/index.js`.

## Verifikasi wajah: batasan yang perlu dipahami

- Server menerima embedding wajah (vektor 128 angka, dihitung browser lewat MediaPipe Face Landmarker â€”
  model & wasm disajikan dari `frontend/public/wajah/`, bukan CDN) dan membandingkan jaraknya dengan
  template terenkripsi (AES-256-GCM). Pada alur scan QR, verifikasi dilakukan siswa sendiri; foto absensi
  (JPEG, terenkripsi AES-256-GCM, tabel `wajah_foto`, retensi `FACE_FOTO_RETENSI_HARI`) hanya bisa dibuka
  admin lewat `GET /api/admin/absensi/:id/foto` dan tidak pernah dikirim ke klien lain. Template dihapus
  saat akun dinonaktifkan.
- **Batasan liveness (mode A):** tantangan (nonce sekali pakai + instruksi gerakan) hanya memastikan
  klien menjalankan pengukuran, bukan gerakan nyata. Orang yang memanggil API langsung bisa mengirim
  payload palsu, dan kamera virtual dapat memutar rekaman. Mitigasi terbatas: nonce terikat `user_id`,
  TTL, sekali pakai, rate-limit, audit. Jalur peningkatan ke mode B (pemrosesan server/pihak ketiga)
  sudah disiapkan lewat `src/services/liveness.js` â€” cukup ganti implementasinya.
- `FACE_THRESHOLD` (default 0.5) harus disetel dengan uji coba pada wajah peserta sungguhan. Tidak ada angka
  universal yang aman.
- Data biometrik bersifat sensitif: absensi wajah memerlukan persetujuan peserta (`disetujui_pada`
  di `face_templates`) dan kebijakan retensi tetap harus ditetapkan penyelenggara.

## Deployment produksi

Set `.env` produksi: `NODE_ENV=production`, `DB_SYNC=false`, `SERVE_FRONTEND=true` (backend
menyajikan `frontend/dist` dari origin yang sama; Helmet memasang CSP penuh termasuk
`wasm-unsafe-eval` untuk MediaPipe dan mengizinkan CDN pustaka QR). Di belakang reverse proxy
(Nginx dsb.) set `TRUST_PROXY=true` dan akhiri TLS di proxy. Email sungguhan: isi `SMTP_*`;
tanpa `SMTP_HOST`, email disimulasikan (penerima & subjek dicatat, isi tak pernah di-log). Unload foto tetap 2 MB dan divalidasi magic bytes di `src/middleware/upload.js`.

Backup MySQL (simpan hasilnya di luar server):

```bash
mysqldump --single-transaction --routines -u root -p absensi_pkl > backup-absensi.sql
```

Pemulihan: buat ulang database kosong, jalankan `npm run db:migrate`, lalu:

```bash
node scripts/pulihkan-db.js backup-absensi.sql
```

Catatan audit dependensi: `sprintf-js` (rantai dev-only Jest/istanbul) belum punya rilis perbaikan
dari upstream, jadi risikonya diterima. Nodemailer telah dinaikkan ke 10.x.

## Belum dikerjakan

- Export Excel dan PDF. Saat ini `GET /api/admin/laporan?format=csv` sudah tersedia; Excel bisa memakai `exceljs`, PDF `pdfkit`.
- Pembersihan berkala token QR, verifikasi wajah, dan tantangan liveness yang lama (job harian di
  `src/services/jobs.js`, menyimpan maksimal 24 jam setelah kedaluwarsa).
- Migrasi sudah tersedia dan tervalidasi sintaks; pengujian menyeluruh terhadap MySQL sungguhan
  dilakukan lewat `npm test` (butuh kredensial DB terisi di `.env`).
