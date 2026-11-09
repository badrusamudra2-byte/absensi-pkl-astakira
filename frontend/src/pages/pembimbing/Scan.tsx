import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { TayanganQr } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan } from '../../komponen/ui';
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
      aria-label="Kode QR absensi yang dipindai peserta"
      className="bg-white p-3 rounded-xl w-fit max-w-full overflow-auto mx-auto"
      dangerouslySetInnerHTML={{ __html: q.createSvgTag(10, 0) }}
    />
  );
}

/** Layar pembimbing: tayangkan QR yang dipindai peserta dari HP-nya sendiri. */
export default function Scan() {
  const daring = useOnline();
  const [qr, setQr] = useState<TayanganQr | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [sedang, ubahSedang] = useState(false);
  const [sisa, ubahSisa] = useState(0);
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
      const r = await api<TayanganQr>('/absensi/qr-tayang', { method: 'POST' });
      setQr(r);
      ubahSisa(r.berlaku_detik);
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
      setQr(null);
    } finally {
      ubahSedang(false);
    }
  }, []);

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

  /* Tayangkan QR saat halaman dibuka. */
  useEffect(() => {
    void tayangkan();
    return () => setQr(null);
  }, [tayangkan]);

  /* Hitung mundur kedaluwarsa; saat habis, QR baru otomatis ditayangkan (rotasi). */
  useEffect(() => {
    if (!qr) return undefined;
    const akhir = new Date(qr.kedaluwarsa_pada).getTime();
    const id = setInterval(() => {
      const s = Math.max(0, Math.ceil((akhir - Date.now()) / 1000));
      ubahSisa(s);
      if (s === 0) void tayangkan();
    }, 500);
    return () => clearInterval(id);
  }, [qr, tayangkan]);

  return (
    <>
      <Kartu t="Tayangkan QR absensi">
        {galat ? (
          <>
            <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
            <div className="mt-2">
              <Tombol varian="gh" onClick={() => void tayangkan()} disabled={sedang}>
                Coba lagi
              </Tombol>
            </div>
          </>
        ) : qr ? (
          <>
            <TampilkanQr token={qr.token} />
            <p className="mt-3 text-center">
              Minta peserta memindai QR ini dengan HP-nya. QR berganti dalam{' '}
              <b aria-live="polite">{sisa}</b> detik.
            </p>
            <p className="text-mu text-sm text-center">
              Setiap pindaian yang sah langsung tercatat sebagai absensi; waktu dan status dihitung
              server saat peserta memindai.
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
      {!qr && !galat ? null : (
        <p className="text-xs text-mu mt-1">
          Layar dijaga tetap menyala selama halaman ini terbuka (bila browser mendukung Wake Lock).
        </p>
      )}
      {!daring ? (
        <p className="text-r text-sm mt-1 font-semibold" role="alert">
          Anda sedang luring — QR tidak bisa diperbarui tanpa internet.
        </p>
      ) : null}
    </>
  );
}
