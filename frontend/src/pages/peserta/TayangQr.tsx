import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { jenisPemberitahuan, teksKode } from '../../lib/petaKode';
import { ambilLokasi, type TitikLokasi } from '../../lib/lokasi';
import type { Absensi, Pengaturan, TayanganQr } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Badge, JudulHalaman } from '../../komponen/ui';
import { Ikon } from '../../komponen/Ikon';
import { isoHariIni, tercatatPada } from '../../komponen/umum';
import { useOnline } from '../../komponen/Offline';

/** Tampilkan token server sebagai QR besar (pustaka qrcode-generator dari CDN). */
function TampilkanQr({ token }: { token: string }) {
  if (typeof qrcode === 'undefined') {
    return (
      <p className="text-mu text-sm">Pustaka QR belum termuat. Periksa koneksi internet lalu muat ulang halaman.</p>
    );
  }
  const q = qrcode(0, 'M');
  q.addData(token);
  q.make();
  return (
    <div
      role="img"
      aria-label="Kode QR absensi milik Anda"
      className="w-fit max-w-full overflow-auto mx-auto"
      dangerouslySetInnerHTML={{ __html: q.createSvgTag(10, 0) }}
    />
  );
}

/** Layar peserta: tayangkan QR absensi yang dipindai pembimbing dari HP-nya.
 * Begitu pindaian berhasil (baris absensi tercatat di riwayat), QR hilang dan
 * pemberitahuan keberhasilan tampil di tempatnya. */
export default function TayangQr() {
  const [cari] = useSearchParams();
  const jenis = (cari.get('jenis') === 'pulang' ? 'pulang' : 'masuk') as 'masuk' | 'pulang';
  const daring = useOnline();
  const navigate = useNavigate();
  const [qr, setQr] = useState<TayanganQr | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [kodeGalat, ubahKodeGalat] = useState<string | null>(null);
  const [sedang, ubahSedang] = useState(false);
  const [sisa, ubahSisa] = useState(0);
  const [beres, ubahBeres] = useState<null | { jam: string; status: Absensi['status'] }>(null);
  // Guard antre: bila POST qr-saya sedang berjalan, tick interval tidak menembak
  // permintaan baru (mencegah POST ganda dan respons lama menimpa QR baru).
  const sedangRef = useRef(false);
  const kunciTampil = useRef<{
    release: () => Promise<void>;
    addEventListener: (t: string, f: () => void) => void;
  } | null>(null);
  // Pengaturan absensi: area kantor diatur -> lokasi GPS dikirim bersama QR
  const kantorRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let hidup = true;
    api<Pengaturan>('/pengaturan/absensi')
      .then((r) => {
        if (!hidup) return;
        kantorRef.current =
          r.lat_kantor !== null && r.lng_kantor !== null ? { lat: r.lat_kantor, lng: r.lng_kantor } : null;
      })
      .catch(() => {
        /* gagal diketahui: server tetap menuntut lokasi bila kantor sudah diatur */
      });
    return () => {
      hidup = false;
    };
  }, []);

  const tayangkan = useCallback(async () => {
    if (!navigator.onLine) {
      ubahGalat(['Tidak ada koneksi internet', 'Sambungkan Wi-Fi atau data seluler lalu tayangkan ulang QR.']);
      ubahKodeGalat('JARINGAN');
      return;
    }
    if (sedangRef.current) return; // permintaan rotasi sebelumnya masih berjalan
    sedangRef.current = true;
    ubahSedang(true);
    ubahGalat(null);
    ubahKodeGalat(null);
    try {
      // Area kantor diatur: ambil posisi GPS dulu — validasi jarak dilakukan server
      let lokasi: TitikLokasi | null = null;
      if (kantorRef.current) {
        try {
          lokasi = await ambilLokasi();
        } catch (e) {
          ubahGalat(['Lokasi dibutuhkan', (e as Error).message]);
          return;
        }
      }
      const r = await api<TayanganQr>('/absensi/qr-saya', {
        method: 'POST',
        json: { jenis, ...(lokasi ? { lat: lokasi.lat, lng: lokasi.lng, akurasi_m: lokasi.akurasi_m } : {}) },
      });
      setQr(r);
      ubahSisa(r.berlaku_detik);
    } catch (e) {
      const err = e as ApiError;
      ubahKodeGalat(err.kode ?? 'SERVER');
      // Server menolak QR tanpa verifikasi wajah aktif: awali dari layar verifikasi, bukan galat mentah
      ubahGalat(
        err.kode === 'WAJAH_BELUM_VERIF' || err.kode === 'SUDAH_ABSEN'
          ? teksKode(err.kode, err.message)
          : (teksKode(err.kode ?? 'SERVER', err.message) as [string, string]),
      );
      setQr(null);
    } finally {
      sedangRef.current = false;
      ubahSedang(false);
    }
  }, [jenis]);

  /* Layar tetap menyala selama QR ditayangkan (Screen Wake Lock, bila didukung). */
  useEffect(() => {
    const minta = async () => {
      try {
        const n = navigator as Navigator & {
          wakeLock?: {
            request: (t: 'screen') => Promise<{
              release: () => Promise<void>;
              addEventListener: (t: string, f: () => void) => void;
            }>;
          };
        };
        if (n.wakeLock && !kunciTampil.current) {
          kunciTampil.current = await n.wakeLock.request('screen');
          kunciTampil.current.addEventListener('release', () => (kunciTampil.current = null));
        }
      } catch {
        /* fitur tidak tersedia — biarkan tanpa Wake Lock */
      }
    };
    const saatKembali = () => document.visibilityState === 'visible' && void minta();
    void minta();
    document.addEventListener('visibilitychange', saatKembali);
    return () => {
      document.removeEventListener('visibilitychange', saatKembali);
      kunciTampil.current?.release();
      kunciTampil.current = null;
    };
  }, []);

  /* Buka halaman: bila absensi jenis ini hari ini sudah tercatat (pembimbing
     telah berhasil memindai), tampil panel sukses — QR tidak ditayangkan lagi. */
  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const r = await api<{ data: Absensi[] }>('/absensi/riwayat');
        // Satu baris per hari: data pulang dibaca dari pulang_jam baris masuk;
        // penanda otomatis "Tidak hadir" bukan absensi nyata — QR tetap tayang.
        const cocok = tercatatPada(r.data, isoHariIni(), jenis);
        if (cocok && hidup) {
          ubahBeres({ jam: cocok.jam, status: cocok.status });
          return;
        }
      } catch {
        /* gagal diketahui: lanjut tampilkan QR; server tetap menolak dobel di scan */
      }
      if (hidup) void tayangkan();
    })();
    return () => {
      hidup = false;
      setQr(null);
    };
  }, [tayangkan]);

  /* Hitung mundur kedaluwarsa; saat habis, QR baru otomatis ditayangkan (rotasi). */
  useEffect(() => {
    if (!qr || beres) return undefined;
    const akhir = new Date(qr.kedaluwarsa_pada).getTime();
    const id = setInterval(() => {
      const s = Math.max(0, Math.ceil((akhir - Date.now()) / 1000));
      ubahSisa(s);
      if (s === 0 && !sedangRef.current) void tayangkan();
    }, 500);
    return () => clearInterval(id);
  }, [qr, beres, tayangkan]);

  /* Pantau riwayat: bila absensi jenis ini untuk hari ini sudah tercatat,
     berarti pembimbing berhasil memindai — hentikan QR dan tunjukkan sukses. */
  useEffect(() => {
    if (!qr || beres) return undefined;
    const tanggal = isoHariIni();
    const id = setInterval(async () => {
      if (!navigator.onLine) return; // luring: polling coba lagi di detik berikutnya
      try {
        const r = await api<{ data: Absensi[] }>('/absensi/riwayat');
        const cocok = tercatatPada(r.data, tanggal, jenis);
        if (cocok) {
          setQr(null);
          ubahSisa(0);
          ubahBeres({ jam: cocok.jam, status: cocok.status });
          kunciTampil.current?.release();
        }
      } catch {
        /* galat kecil polling: coba lagi di detik berikutnya */
      }
    }, 4000);
    return () => clearInterval(id);
  }, [qr, beres, jenis]);

  return (
    <>
      <JudulHalaman
        eyebrow="Peserta PKL"
        judul="Tayangkan QR Absen"
        sub="Tunjukkan QR ini ke pembimbing untuk mencatat kehadiran Anda."
      />
      <Kartu className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-garis">
          <div className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-pl text-pr grid place-items-center">
              <Ikon nama="qr" className="size-4" />
            </span>
            <b className="text-[12.5px] font-extrabold">QR absen {jenis}</b>
          </div>
          {qr && !beres ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[10px] font-semibold text-mu">
              <span className="size-1.5 rounded-full bg-[#15803d] animate-pulse" aria-hidden="true" />
              Aktif
            </span>
          ) : null}
        </div>

        <div className="p-4 md:p-5">
          {beres ? (
            <div className="text-center py-4">
              <div className="size-20 rounded-full bg-[#dcfce7] text-[#15803d] grid place-items-center mx-auto mb-3">
                <Ikon nama="checkCircle" className="size-10" />
              </div>
              <h2 className="text-lg font-extrabold mb-2">Absensi {jenis} tercatat</h2>
              <p className="text-[12.5px] text-[#4a5a72]">
                Tercatat <b aria-live="polite">{beres.jam.slice(0, 5)}</b> &mdash; <Badge s={beres.status} />
              </p>
              <div className="mt-4 flex gap-2 justify-center flex-wrap">
                <Tombol varian="gh" onClick={() => navigate('/riwayat')}>Lihat riwayat</Tombol>
                <Tombol onClick={() => navigate('/absensi')}>Selesai</Tombol>
              </div>
            </div>
          ) : galat ? (
            <div className="py-2">
              <Pemberitahuan jenis={jenisPemberitahuan(kodeGalat)} judul={galat[0]} uraian={galat[1]} />
              {galat[0] === teksKode('WAJAH_BELUM_VERIF')[0] ? (
                <div className="mt-3 text-center">
                  <Tombol onClick={() => navigate(`/wajah/periksa?jenis=${jenis}&genap=scan`)}>
                    Verifikasi wajah dahulu
                  </Tombol>
                </div>
              ) : (
                <div className="mt-3">
                  <Tombol varian="gh" onClick={() => void tayangkan()} disabled={sedang}>
                    Coba lagi
                  </Tombol>
                </div>
              )}
            </div>
          ) : qr ? (
            <div className="grid md:grid-cols-[1fr_0.85fr] gap-5 items-start">
              <div className="rounded-xl border border-garis bg-white p-3 w-fit max-w-full mx-auto md:mx-0">
                <TampilkanQr token={qr.token} />
              </div>
              <div>
                <div className="rounded-xl border border-[#d8e3f6] bg-[#f6f9ff] p-3 text-center">
                  <div className="text-[9.5px] font-extrabold uppercase tracking-[1px] text-mu">QR berganti dalam</div>
                  <div className="text-[26px] font-extrabold tracking-tight text-pr leading-none mt-1" aria-live="polite">
                    {sisa}
                    <span className="text-[12px] text-mu font-bold ml-1">detik</span>
                  </div>
                </div>
                <p className="text-[12px] font-semibold text-[#334155] mt-3">
                  Tunjukkan QR ini untuk dipindai oleh pembimbing.
                </p>
                <p className="text-[11px] text-mu leading-relaxed mt-1.5">
                  Bila pembimbing sudah berhasil memindai, Anda akan melihatnya di menu Riwayat. Absensi hanya
                  tercatat sekali per jenis per hari. Pada metode QR + Wajah, verifikasi wajah yang kedaluwarsa
                  akan ditolak — ulangi verifikasi dari menu Absensi.
                </p>
                <div className="mt-3">
                  <Tombol varian="gh" className="w-full" onClick={() => void tayangkan()} disabled={sedang}>
                    <Ikon nama="refresh" className="size-3.5" />
                    {sedang ? 'Menayangkan…' : 'Ganti QR sekarang'}
                  </Tombol>
                </div>
                <p className="text-[10px] text-mu mt-2 flex items-start gap-1.5">
                  <Ikon nama="info" className="size-3.5 shrink-0 mt-0.5" />
                  Layar dijaga tetap menyala selama halaman ini terbuka (bila browser mendukung Wake Lock).
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <Ikon nama="refresh" className="size-6 text-pr animate-spin mx-auto mb-2" />
              <p className="text-mu text-sm">{sedang ? 'Menayangkan QR…' : 'Menyiapkan QR…'}</p>
            </div>
          )}
        </div>
      </Kartu>

      {!daring ? (
        <p className="text-r text-sm mt-2 font-semibold" role="alert">
          Anda sedang luring — QR tidak bisa diperbarui tanpa internet.
        </p>
      ) : null}
      {beres ? null : (
        <p className="text-[11.5px] text-mu mt-2">
          <Link to="/absensi" className="inline-flex items-center gap-1 font-semibold text-pr no-underline">
            <Ikon nama="chevron" className="size-3 rotate-180" />
            Kembali ke pilihan absensi
          </Link>
        </p>
      )}
    </>
  );
}
