import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { HasilKonfirmasi, Jenis, MetodeAbsensi } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Badge } from '../../komponen/ui';
import { useOnline } from '../../komponen/Offline';

/** Hasil verifikasi wajah dibawa dari halaman wajah (genap=scan). */
interface BawaanWajah {
  embedding: number[];
  nonce: string | null;
}

export default function ScanPembimbing() {
  const [cari] = useSearchParams();
  const jenis = (cari.get('jenis') === 'pulang' ? 'pulang' : 'masuk') as Jenis;
  const navigate = useNavigate();
  const lokasi = useLocation();
  const bawaan = (lokasi.state ?? null) as BawaanWajah | null;
  const daring = useOnline();

  const [metode, ubahMetode] = useState<MetodeAbsensi | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [hasil, ubahHasil] = useState<HasilKonfirmasi | null>(null);
  const [sedang, ubahSedang] = useState(false);
  const [berjalan, ubahBerjalan] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const aliranRef = useRef<MediaStream | null>(null);
  const kirimRef = useRef(false); // hindari kirim ganda dari frame beruntun
  const metodeRef = useRef<MetodeAbsensi | null>(null);
  const bawaanRef = useRef<BawaanWajah | null>(bawaan);

  /** Kamera berhenti (dipanggil dari effect dan sebelum navigasi). */
  const berhenti = () => {
    if (aliranRef.current) {
      aliranRef.current.getTracks().forEach((t) => t.stop());
      aliranRef.current = null;
    }
  };

  const kirim = async (token: string) => {
    const m = metodeRef.current;
    if (!m) return;
    // qr_wajah butuh embedding dari langkah verifikasi wajah; tanpa itu arahkan mulai dari awal
    if (m === 'qr_wajah' && !bawaanRef.current) {
      ubahGalat([
        'Mulai dari halaman absensi',
        'Verifikasi wajah perlu dilakukan sebelum memindai QR. Tekan tombol mulai absen di halaman Absensi.',
      ]);
      kirimRef.current = false;
      ubahSedang(false);
      return;
    }
    ubahSedang(true);
    ubahGalat(null);
    try {
      const em = bawaanRef.current?.embedding;
      const r = await api<HasilKonfirmasi>('/absensi/konfirmasi-scan', {
        method: 'POST',
        json:
          m === 'qr_wajah'
            ? { token, jenis, embedding: em, ...(bawaanRef.current?.nonce ? { nonce: bawaanRef.current.nonce } : {}) }
            : { token, jenis },
      });
      berhenti();
      ubahBerjalan(false);
      ubahHasil(r);
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
      if (err.kode === 'TEMPLATE_BELUM') {
        // Tanpa template, scan ulang tidak akan berhasil — berhenti dan arahkan mendaftar
        berhenti();
        ubahBerjalan(false);
        kirimRef.current = false;
      } else {
        kirimRef.current = false; // QR kedaluwarsa/dipakai: kamera lanjut memindai QR terbaru
      }
    } finally {
      ubahSedang(false);
    }
  };

  /* Metode absensi menentukan isi permintaan konfirmasi. */
  useEffect(() => {
    api<{ metode: MetodeAbsensi }>('/pengaturan/absensi')
      .then((r) => {
        ubahMetode(r.metode);
        metodeRef.current = r.metode;
      })
      .catch(() => {
        ubahMetode('qr_wajah');
        metodeRef.current = 'qr_wajah';
      });
  }, []);

  /* Kamera + deteksi QR (BarcodeDetector bila ada, jsQR fallback). */
  useEffect(() => {
    if (!berjalan) {
      berhenti();
      return undefined;
    }
    let hidup = true;
    let uji: number | null = null;

    const proses = () => {
      if (!hidup) return;
      const vid = videoRef.current;
      if (vid && vid.readyState >= 2 && !kirimRef.current) {
        const ketemu = (nilai: string) => {
          if (!nilai) return false;
          kirimRef.current = true;
          void kirim(nilai);
          return true;
        };
        const BD = (window as unknown as {
          BarcodeDetector?: new (o: { formats: string[] }) => {
            detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
          };
        }).BarcodeDetector;
        if (BD) {
          const detektor = new BD({ formats: ['qr_code'] });
          detektor
            .detect(vid)
            .then((codes) => {
              if (codes.length && codes[0].rawValue && ketemu(codes[0].rawValue)) return;
              uji = window.setTimeout(proses, 250);
            })
            .catch(() => {
              uji = window.setTimeout(proses, 250);
            });
          return;
        }
        if (typeof jsQR !== 'undefined') {
          const w = Math.min(vid.videoWidth || 640, 640);
          const f = w / (vid.videoWidth || 640);
          const kanvas = document.createElement('canvas');
          kanvas.width = w;
          kanvas.height = Math.round((vid.videoHeight || 480) * f);
          const k = kanvas.getContext('2d');
          if (k) {
            k.drawImage(vid, 0, 0, kanvas.width, kanvas.height);
            const img = k.getImageData(0, 0, kanvas.width, kanvas.height);
            const q = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (q && q.data && ketemu(q.data)) return;
          }
        }
      }
      uji = window.setTimeout(proses, 250);
    };

    const mulai = async () => {
      try {
        const aliran = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!hidup) {
          aliran.getTracks().forEach((t) => t.stop());
          return;
        }
        aliranRef.current = aliran;
        const v = videoRef.current;
        if (v) {
          v.srcObject = aliran;
          await v.play();
        }
        void proses();
      } catch {
        if (hidup) {
          ubahBerjalan(false);
          ubahGalat(['Kamera tidak bisa dibuka', 'Beri izin kamera pada browser lalu coba lagi.']);
        }
      }
    };
    void mulai();
    return () => {
      hidup = false;
      if (uji !== null) window.clearTimeout(uji);
      berhenti();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [berjalan]);

  return (
    <>
      <Kartu t={`Pindai QR pembimbing — absen ${jenis}`}>
        {galat ? (
          <div className="mb-3">
            <Pemberitahuan
              jenis="er"
              judul={galat[0]}
              uraian={galat[1]}
              aksi={galat[0] === teksKode('TEMPLATE_BELUM')[0] ? (
                <Link to="/wajah/daftar" className="underline font-semibold">Daftarkan wajah sekarang</Link>
              ) : undefined}
            />
          </div>
        ) : null}

        {hasil ? (
          <div className="text-center py-2">
            <div className="w-16 h-16 rounded-full bg-[#15803d20] text-g text-3xl leading-16 mx-auto mb-2">&#10003;</div>
            <h2 className="text-lg font-extrabold mb-2">Absensi {jenis} tercatat</h2>
            <p>
              Tercatat <b aria-live="polite">{hasil.jam.slice(0, 5)}</b> &mdash; <Badge s={hasil.status} />
            </p>
            <p className="text-mu text-sm mt-1">Metode {hasil.metode}.</p>
            <div className="mt-3 flex gap-2 justify-center">
              <Tombol varian="gh" onClick={() => navigate('/riwayat')}>Lihat riwayat</Tombol>
              <Tombol onClick={() => navigate('/absensi')}>Selesai</Tombol>
            </div>
          </div>
        ) : berjalan ? (
          <>
            <p role="status">Arahkan kamera ke QR di layar pembimbing&hellip;</p>
            <video
              ref={videoRef}
              className="w-full max-w-[460px] rounded-xl border border-garis bg-black mx-auto"
              playsInline
              muted
            />
            <div className="mt-2">
              <Tombol varian="gh" onClick={() => ubahBerjalan(false)}>Berhenti kamera</Tombol>
            </div>
          </>
        ) : (
          <>
            <p className="text-mu text-sm">
              {metode === 'qr_wajah' && !bawaan
                ? 'Verifikasi wajah sudah dilakukan? Bila belum, mulai dari tombol absen di halaman Absensi.'
                : 'Tekan tombol di bawah lalu arahkan kamera HP ke kode QR yang ditayangkan pembimbing.'}
            </p>
            <div className="mt-3">
              <Tombol
                onClick={() => { ubahGalat(null); ubahBerjalan(true); }}
                disabled={!daring || sedang || metode === null}
              >
                {sedang ? 'Mengirim absensi…' : 'Buka kamera'}
              </Tombol>
            </div>
            <p className="text-xs text-mu mt-2">
              QR berganti tiap 30 detik. Bila QR kedaluwarsa, scan ulang QR terbaru — absensi Anda
              dihitung dari saat server menerima pindaian.
            </p>
          </>
        )}
      </Kartu>
      {!hasil ? (
        <p className="text-xs text-mu mt-1">
          <Link to="/absensi" className="underline">Kembali ke pilihan absensi</Link>
        </p>
      ) : null}
    </>
  );
}
