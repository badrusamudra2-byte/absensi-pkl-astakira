import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { HasilScan, MetodeAbsensi } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Badge } from '../../komponen/ui';
import { useOnline } from '../../komponen/Offline';

type Tahap = 'mulai' | 'qr' | 'beres';

/** Layar pembimbing: pindai QR milik peserta lalu rekam absensi.
 * Verifikasi wajah dilakukan peserta sendiri di HP-nya sebelum QR tayang
 * (mode qr_wajah); dari sini cukup token QR yang dikirim ke server. */
export default function Scan() {
  const daring = useOnline();
  const navigate = useNavigate();
  const [tahap, ubahTahap] = useState<Tahap>('mulai');
  const [metode, ubahMetode] = useState<MetodeAbsensi | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [hasil, ubahHasil] = useState<HasilScan | null>(null);
  const [merekam, ubahMerekam] = useState(false);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    api<{ metode: MetodeAbsensi }>('/pengaturan/absensi')
      .then((r) => ubahMetode(r.metode))
      .catch(() => ubahMetode('qr_wajah')); // gagal baca: pakai mode bawaan server
  }, []);

  const ulang = () => {
    ubahGalat(null);
    ubahHasil(null);
    tokenRef.current = null;
    ubahMerekam(false);
    ubahTahap('mulai');
  };

  /** Token QR hasil pindai dikirim apa adanya; status dan waktu ditentukan server. */
  const prosesToken = async (token: string) => {
    tokenRef.current = token;
    if (!navigator.onLine) {
      ubahGalat(['Tidak ada koneksi internet', 'Pemindaian perlu server. Sambungkan internet lalu scan ulang QR.']);
      ubahTahap('mulai');
      return;
    }
    ubahMerekam(true);
    try {
      const r = await api<HasilScan>('/absensi/scan', { method: 'POST', json: { token } });
      ubahHasil(r);
      ubahGalat(null);
      ubahTahap('beres');
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
      ubahTahap('mulai');
    } finally {
      ubahMerekam(false);
    }
  };

  return (
    <>
      <Kartu t="Pindai QR peserta">
        {galat ? (
          <div className="mb-3">
            <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
            <div className="mt-2">
              <Tombol varian="gh" onClick={ulang}>Scan ulang</Tombol>
            </div>
          </div>
        ) : null}

        {tahap === 'beres' && hasil ? (
          <div className="text-center py-2">
            <div className="w-16 h-16 rounded-full bg-[#15803d20] text-g text-3xl leading-16 mx-auto mb-2">&#10003;</div>
            <h2 className="text-lg font-extrabold mb-1">Absensi <b>{hasil.nama}</b> tercatat</h2>
            <p>
              Tercatat <b aria-live="polite">{hasil.jam.slice(0, 5)}</b> &mdash; <Badge s={hasil.status} />
            </p>
            <p className="text-mu text-sm mt-1">Metode {hasil.metode}.</p>
            <div className="mt-3 flex gap-2 justify-center">
              <Tombol varian="gh" onClick={ulang}>Scan peserta berikutnya</Tombol>
              <Tombol onClick={() => navigate('/')}>Selesai</Tombol>
            </div>
          </div>
        ) : null}

        {tahap === 'mulai' ? (
          <>
            <p className="text-mu text-sm">
              {metode === 'wajah'
                ? 'Metode absensi saat ini tidak memakai QR (MODE_QR_NONAKTIF). Absensi dicatat langsung dari HP peserta.'
                : 'Tekan tombol di bawah lalu arahkan kamera HP ke QR yang ditayangkan peserta di HP-nya.'}
            </p>
            <div className="mt-3">
              <Tombol onClick={() => { ubahGalat(null); ubahTahap('qr'); }} disabled={!daring || metode === null}>
                Buka kamera
              </Tombol>
            </div>
            <p className="text-xs text-mu mt-2">
              QR milik peserta berganti tiap 30 detik. Bila QR kedaluwarsa, scan ulang QR terbaru —
              absensi dihitung dari saat server menerima pindaian.
              {metode === 'qr_wajah' ? ' Pada metode QR+Wajah, peserta wajib lolos verifikasi wajah di HP-nya lebih dulu.' : ''}
            </p>
          </>
        ) : null}

        {tahap === 'qr' ? <TahapQr onToken={(t) => { void prosesToken(t); }} /> : null}
      </Kartu>
      {tahap === 'beres' && hasil ? (
        <p className="text-xs text-mu mt-1">
          <Link to="/pembimbing/rekap" className="underline">Buka rekap periode</Link>
        </p>
      ) : null}
      {merekam ? <p className="text-mu text-sm mt-1" role="status" aria-live="polite">Merekam absensi&hellip;</p> : null}
      {!daring ? (
        <p className="text-r text-sm mt-1 font-semibold" role="alert">
          Anda sedang luring — pemindaian perlu internet.
        </p>
      ) : null}
    </>
  );
}

/** Fase pemindai QR: kamera + deteksi QR (BarcodeDetector bila ada, jsQR fallback);
 * token hasil pindai dikirim ke onToken lalu kamera berhenti. */
function TahapQr({ onToken }: { onToken: (token: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const aliranRef = useRef<MediaStream | null>(null);
  const terkirimRef = useRef(false);

  const berhenti = () => {
    if (aliranRef.current) {
      aliranRef.current.getTracks().forEach((t) => t.stop());
      aliranRef.current = null;
    }
  };

  useEffect(() => {
    let hidup = true;
    let uji: number | null = null;

    const proses = () => {
      if (!hidup) return;
      const vid = videoRef.current;
      if (vid && vid.readyState >= 2 && !terkirimRef.current) {
        const ketemu = (nilai: string) => {
          if (!nilai) return false;
          terkirimRef.current = true;
          berhenti();
          onToken(nilai);
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
        /* kamera gagal: dikendalikan peserta lewat tombol "Buka kamera" dan bantui tulisan */
      }
    };
    void mulai();
    return () => {
      hidup = false;
      if (uji !== null) window.clearTimeout(uji);
      berhenti();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <p role="status">Arahkan kamera ke QR di layar HP peserta&hellip;</p>
      <video
        ref={videoRef}
        className="w-full max-w-[460px] rounded-xl border border-garis bg-black mx-auto"
        playsInline
        muted
      />
    </>
  );
}
