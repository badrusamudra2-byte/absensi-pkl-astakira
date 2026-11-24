import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { jenisPemberitahuan, teksKode } from '../../lib/petaKode';
import type { HasilScan, MetodeAbsensi } from '../../lib/tipe';
import { Kartu, JudulHalaman, Tombol, Pemberitahuan, Badge } from '../../komponen/ui';
import { useOnline } from '../../komponen/Offline';
import { Ikon } from '../../komponen/Ikon';

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
  const [kodeGalat, ubahKodeGalat] = useState<string | null>(null);
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
    ubahKodeGalat(null);
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
      ubahKodeGalat('JARINGAN');
      ubahTahap('mulai');
      return;
    }
    ubahMerekam(true);
    try {
      const r = await api<HasilScan>('/absensi/scan', { method: 'POST', json: { token } });
      ubahHasil(r);
      ubahGalat(null);
      ubahKodeGalat(null);
      ubahTahap('beres');
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
      ubahKodeGalat(err.kode ?? 'SERVER');
      ubahTahap('mulai');
    } finally {
      ubahMerekam(false);
    }
  };

  return (
    <>
      <JudulHalaman
        eyebrow="Pembimbing"
        judul="Scan QR peserta"
        sub="Pindai QR absensi yang ditayangkan peserta untuk mencatat kehadiran."
      />

      {galat ? (
        <div className="mb-4">
          <Pemberitahuan jenis={jenisPemberitahuan(kodeGalat)} judul={galat[0]} uraian={galat[1]} />
          <div className="mt-2">
            <Tombol varian="gh" onClick={ulang}>Scan ulang</Tombol>
          </div>
        </div>
      ) : null}

      {tahap === 'beres' && hasil ? (
        <>
          <Kartu>
            <div className="flex flex-col items-center px-4 py-6 text-center">
              <span className="grid size-16 place-items-center rounded-full bg-[#15803d18] text-g">
                <Ikon nama="checkCircle" className="size-8" />
              </span>
              <h2 className="mt-3 text-lg font-extrabold tracking-tight">Absensi {hasil.nama} tercatat</h2>
              <p className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm text-mu">
                Tercatat <b className="text-teks" aria-live="polite">{hasil.jam.slice(0, 5)}</b>
                <Badge s={hasil.status} />
              </p>
              <p className="mt-1 text-xs text-mu">Metode {hasil.metode}.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Tombol varian="gh" onClick={ulang}>Scan peserta berikutnya</Tombol>
                <Tombol onClick={() => navigate('/')}>Selesai</Tombol>
              </div>
            </div>
          </Kartu>
          <p className="mt-1 text-xs text-mu">
            <Link to="/pembimbing/rekap" className="font-semibold text-pr underline">Buka rekap periode</Link>
          </p>
        </>
      ) : null}

      {tahap === 'mulai' ? (
        <div className="grid items-start gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Kartu t="Pindai QR peserta">
            <div className="flex flex-col items-center rounded-xl border border-dashed border-[#c7d5e8] bg-[#fbfcfe] px-4 py-7 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-pl text-pr">
                <Ikon nama="scan" className="size-7" />
              </span>
              <p className="mt-3 max-w-[360px] text-xs leading-relaxed text-mu">
                {metode === 'wajah'
                  ? 'Metode absensi saat ini tidak memakai QR (MODE_QR_NONAKTIF). Absensi dicatat langsung dari HP peserta.'
                  : 'Tekan tombol di bawah lalu arahkan kamera HP ke QR yang ditayangkan peserta di HP-nya.'}
              </p>
              <div className="mt-4">
                <Tombol onClick={() => { ubahGalat(null); ubahKodeGalat(null); ubahTahap('qr'); }} disabled={!daring || metode === null}>
                  <Ikon nama="camera" className="size-4" />
                  Buka kamera
                </Tombol>
              </div>
              {metode === null ? <p className="mt-2 text-[11px] text-mu">Memuat metode absensi&hellip;</p> : null}
            </div>
          </Kartu>

          <Kartu t="Petunjuk">
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {[
                'Minta peserta membuka halaman Tayangkan QR absen di HP-nya.',
                'Arahkan kamera ke QR hingga sistem membaca kode secara otomatis.',
                'Absensi dihitung saat server menerima pindaian; QR berganti tiap 30 detik.',
                'Bila QR kedaluwarsa, minta peserta memperbarui lalu scan ulang.',
              ].map((p, i) => (
                <li key={p} className="flex items-start gap-2.5 text-[11.5px] leading-snug text-[#4a5a72]">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-pl text-[10px] font-extrabold text-pr">{i + 1}</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            {metode === 'qr_wajah' ? (
              <div className="mt-4 rounded-xl border border-[#c7dbff] bg-[#eaf2ff] p-3">
                <p className="flex items-start gap-2 text-[11px] leading-relaxed text-pr">
                  <Ikon nama="shield" className="mt-0.5 size-3.5 shrink-0" />
                  Pada metode QR+Wajah, peserta wajib lolos verifikasi wajah di HP-nya sebelum QR tayang.
                </p>
              </div>
            ) : null}
          </Kartu>
        </div>
      ) : null}

      {tahap === 'qr' ? (
        <Kartu t="Arahkan kamera ke QR peserta">
          <TahapQr onToken={(t) => { void prosesToken(t); }} />
        </Kartu>
      ) : null}

      {merekam ? <p className="mt-2 text-sm text-mu" role="status" aria-live="polite">Merekam absensi&hellip;</p> : null}
      {!daring ? (
        <p className="mt-2 text-sm font-semibold text-r" role="alert">
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
      <p className="mb-2 flex items-center gap-2 text-sm text-mu" role="status">
        <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-g" aria-hidden="true" />
        Arahkan kamera ke QR di layar HP peserta&hellip;
      </p>
      <div className="kamera-latar relative mx-auto aspect-[4/3] w-full max-w-[480px] overflow-hidden rounded-[14px] border border-[#1e3a6e]">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-[62%] w-[62%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(4,12,28,.34)]" />
        </div>
      </div>
    </>
  );
}
