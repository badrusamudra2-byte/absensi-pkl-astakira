import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { Absensi, TayanganQr } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Badge } from '../../komponen/ui';
import { isoHariIni } from '../../komponen/umum';
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
      className="bg-white p-3 rounded-xl w-fit max-w-full overflow-auto mx-auto"
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
  const [sedang, ubahSedang] = useState(false);
  const [sisa, ubahSisa] = useState(0);
  const [beres, ubahBeres] = useState<null | { jam: string; status: Absensi['status'] }>(null);
  const kunciTampil = useRef<{
    release: () => Promise<void>;
    addEventListener: (t: string, f: () => void) => void;
  } | null>(null);

  const tayangkan = useCallback(async () => {
    if (!navigator.onLine) {
      ubahGalat(['Tidak ada koneksi internet', 'Sambungkan Wi-Fi atau data seluler lalu tayangkan ulang QR.']);
      return;
    }
    ubahSedang(true);
    ubahGalat(null);
    try {
      const r = await api<TayanganQr>('/absensi/qr-saya', { method: 'POST', json: { jenis } });
      setQr(r);
      ubahSisa(r.berlaku_detik);
    } catch (e) {
      const err = e as ApiError;
      // Server menolak QR tanpa verifikasi wajah aktif: awali dari layar verifikasi, bukan galat mentah
      ubahGalat(
        err.kode === 'WAJAH_BELUM_VERIF' || err.kode === 'SUDAH_ABSEN'
          ? teksKode(err.kode, err.message)
          : (teksKode(err.kode ?? 'SERVER', err.message) as [string, string]),
      );
      setQr(null);
    } finally {
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
        const cocok = r.data.find((x) => x.tanggal === isoHariIni() && x.jenis === jenis);
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
      if (s === 0) void tayangkan();
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
        const cocok = r.data.find((x) => x.tanggal === tanggal && x.jenis === jenis);
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
      <Kartu t={`Tayangkan QR absen ${jenis}`}>
        {beres ? (
          <div className="text-center py-2">
            <div className="w-16 h-16 rounded-full bg-[#15803d20] text-g text-3xl leading-16 mx-auto mb-2">&#10003;</div>
            <h2 className="text-lg font-extrabold mb-2">Absensi {jenis} tercatat</h2>
            <p>
              Tercatat <b aria-live="polite">{beres.jam.slice(0, 5)}</b> &mdash; <Badge s={beres.status} />
            </p>
            <div className="mt-3 flex gap-2 justify-center">
              <Tombol varian="gh" onClick={() => navigate('/riwayat')}>Lihat riwayat</Tombol>
              <Tombol onClick={() => navigate('/absensi')}>Selesai</Tombol>
            </div>
          </div>
        ) : galat ? (
          <>
            <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
            {galat[0] === teksKode('WAJAH_BELUM_VERIF')[0] ? (
              <div className="mt-2 text-center">
                <Tombol onClick={() => navigate(`/wajah/periksa?jenis=${jenis}&genap=scan`)}>
                  Verifikasi wajah dahulu
                </Tombol>
              </div>
            ) : (
              <div className="mt-2">
                <Tombol varian="gh" onClick={() => void tayangkan()} disabled={sedang}>
                  Coba lagi
                </Tombol>
              </div>
            )}
          </>
        ) : qr ? (
          <>
            <TampilkanQr token={qr.token} />
            <p className="mt-3 text-center">
              Tunjukkan QR ini untuk dipindai oleh pembimbing. QR berganti dalam{' '}
              <b aria-live="polite">{sisa}</b> detik.
            </p>
            <p className="text-mu text-sm text-center">
              Bila pembimbing sudah berhasil memindai, Anda akan melihatnya di menu Riwayat. Absensi
              hanya tercatat sekali per jenis per hari. Pada metode QR+Wajah bila verifikasi wajah
              Anda sudah kedaluwarsa, pindaian akan ditolak — ulangi verifikasi dari menu Absensi.
            </p>
            <div className="mt-2 text-center">
              <Tombol varian="gh" onClick={() => void tayangkan()} disabled={sedang}>
                {sedang ? 'Menayangkan…' : 'Ganti QR sekarang'}
              </Tombol>
            </div>
          </>
        ) : (
          <p className="text-mu">{sedang ? 'Menayangkan QR…' : 'Menyiapkan QR…'}</p>
        )}
      </Kartu>
      {qr ? (
        <p className="text-xs text-mu mt-1">
          Layar dijaga tetap menyala selama halaman ini terbuka (bila browser mendukung Wake Lock).
        </p>
      ) : null}
      {!daring ? (
        <p className="text-r text-sm mt-1 font-semibold" role="alert">
          Anda sedang luring — QR tidak bisa diperbarui tanpa internet.
        </p>
      ) : null}
      {beres ? null : (
        <p className="text-xs text-mu mt-1">
          <Link to="/absensi" className="underline">Kembali ke pilihan absensi</Link>
        </p>
      )}
    </>
  );
}
