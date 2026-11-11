import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import { ambilLandmarker, cekKondisi, hitungEmbedding, PESAN_KONDISI, type Kondisi } from '../../lib/wajah';
import { Kartu, Tombol, Pemberitahuan } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';

const KUNCI_SETUJU = 'astakira_setuju_wajah';

export default function WajahDaftar() {
  const navigate = useNavigate();
  const toast = useToast();
  const [setuju, setujuUlah] = useState(() => localStorage.getItem(KUNCI_SETUJU) === '1');
  const [pesan, ubahPesan] = useState('Menghidupkan kamera…');
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [menyusun, ubahMenyusun] = useState(0); // 0..12 frame terkumpul
  const [kirim, ubahKirim] = useState(false);
  const [beres, ubahBeres] = useState(false);
  // Naikkan untuk memulai ulang kamera dari awal (tombol "Coba lagi")
  const [percobaan, ubahPercobaan] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hentikanRef = useRef<(() => void) | null>(null);
  const setujuRef = useRef(setuju);
  setujuRef.current = setuju;
  // Kondisi dikendalikan dari luar loop rAF (state dalam closure effect akan basi):
  const kirimRef = useRef(false);
  const gagalRef = useRef(false);

  const daftar = useCallback(async (em: number[]) => {
    if (!setujuRef.current) {
      ubahGalat(['Persetujuan dibutuhkan', teksKode('PERSETUJUAN_WAJIB')[1]]);
      return;
    }
    kirimRef.current = true;
    ubahKirim(true);
    try {
      await api<{ pesan: string }>('/face/enroll', { method: 'POST', json: { embedding: em, persetujuan: true } });
      localStorage.setItem(KUNCI_SETUJU, '1');
      ubahBeres(true);
      hentikanRef.current?.();
      toast('Template wajah terdaftar.');
    } catch (e) {
      const err = e as ApiError;
      gagalRef.current = true; // berhenti mengirim ulang otomatis sampai pengguna menekan tombol
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    } finally {
      kirimRef.current = false;
      ubahKirim(false);
    }
  }, [toast]);

  useEffect(() => {
    let hidup = true;
    let raf = 0;
    let antarFrame: number[][] = [];

    const mulai = async () => {
      try {
        const l = await ambilLandmarker();
        const aliran = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
        if (!hidup) { aliran.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = aliran;
        await v.play();
        hentikanRef.current = () => aliran.getTracks().forEach((t) => t.stop());

        const step = () => {
          if (!hidup) return;
          if (v.readyState >= 2) {
            const ts = performance.now();
            if (v.currentTime !== (v as HTMLVideoElement & { _ts?: number })._ts) {
              (v as HTMLVideoElement & { _ts?: number })._ts = v.currentTime;
              const res = l.detectForVideo(v, ts);
              const kondis = cekKondisi(res, v);
              if (kondis) {
                ubahPesan(PESAN_KONDISI[kondis as Exclude<Kondisi, null>]);
                antarFrame = [];
                ubahMenyusun(0);
              } else if (!kirimRef.current && !gagalRef.current) {
                antarFrame.push(hitungEmbedding(res.faceLandmarks![0]));
                if (antarFrame.length > 12) antarFrame.shift();
                ubahMenyusun(antarFrame.length);
                ubahPesan('Jaga wajah tetap di dalam bingkai…');
                if (antarFrame.length === 12) {
                  // Rata-rata frame agar stabil; kirim sekali lalu kosongkan buffer
                  const em = antarFrame[0].map((_, i) => antarFrame.reduce((s, f) => s + f[i], 0) / antarFrame.length);
                  antarFrame = [];
                  ubahMenyusun(0);
                  void daftar(em);
                }
              }
            }
          }
          raf = window.requestAnimationFrame(step);
        };
        void step();
      } catch {
        if (hidup) {
          ubahPesan('');
          ubahGalat(['Kamera tidak bisa dibuka', 'Beri izin kamera pada browser lalu muat ulang halaman.']);
        }
      }
    };
    void mulai();
    return () => {
      hidup = false;
      cancelAnimationFrame(raf);
      hentikanRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percobaan]);

  return (
    <>
      <Kartu t="Pendaftaran wajah">
        {galat ? (
          <div className="mb-3">
            <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
            <div className="mt-2">
              <Tombol
                varian="gh"
                onClick={() => {
                  ubahGalat(null);
                  gagalRef.current = false;
                  ubahPesan('Menghidupkan kamera…');
                  ubahPercobaan((n) => n + 1); // jalankan ulang effect kamera dari awal
                }}
              >
                Coba lagi
              </Tombol>
            </div>
          </div>
        ) : null}
        <p className="text-mu text-sm mb-2">
          Bergerak melalui deteksi di perangkat Anda: tiket gambar wajah tidak pernah dikirim ke server. Yang
          disimpan hanya berupa vektor angka (embedding, terenkripsi AES-256-GCM) untuk pencocokan.
        </p>
        <label className="flex items-center gap-2 my-2 max-w-fit">
          <input
            type="checkbox"
            checked={setuju}
            onChange={(e) => setujuUlah(e.target.checked)}
          />
          Saya setuju data wajah saya dipakai untuk pencilan absensi (tersimpan terenkripsi).
        </label>

        {beres ? (
          <div className="text-center py-3">
            <div className="w-16 h-16 rounded-full bg-[#15803d20] text-g text-3xl leading-16 mx-auto mb-2">&#10003;</div>
            <b className="block mb-1">Pendaftaran berhasil</b>
            <p className="text-mu text-sm mb-2">Sekarang Anda bisa melakukan verifikasi wajah untuk absen.</p>
            <Tombol onClick={() => navigate('/absensi')}>Ke halaman absensi</Tombol>
          </div>
        ) : (
          <>
            <div className="relative w-fit mx-auto">
              <video ref={videoRef} className="rounded-xl border border-garis bg-black max-w-full" playsInline muted />
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-pr rounded-[50%] w-[min(60vw,240px)] h-[min(78vw,310px)] pointer-events-none"
              />
            </div>
            <p className="mt-3" role="status" aria-live="polite">{pesan}</p>
            <p className="text-xs text-mu mt-1" aria-live="polite">
              {menyusun > 0 ? `Mengumpulkan sampel ${menyusun}/12…` : ''}
            </p>
            {kirim ? <p className="text-mu text-sm">Mengirim ke server…</p> : null}
          </>
        )}
      </Kartu>
    </>
  );
}
