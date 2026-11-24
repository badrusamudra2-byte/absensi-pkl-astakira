import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import { ambilLandmarker, cekKondisi, hitungEmbedding, PESAN_KONDISI, type Kondisi } from '../../lib/wajah';
import { Kartu, Tombol, Pemberitahuan, JudulHalaman } from '../../komponen/ui';
import { Ikon } from '../../komponen/Ikon';
import { useToast } from '../../komponen/Toast';

const KUNCI_SETUJU = 'astakira_setuju_wajah';

export default function WajahDaftar() {
  const navigate = useNavigate();
  const toast = useToast();
  const [setuju, setujuUlah] = useState(() => localStorage.getItem(KUNCI_SETUJU) === '1');
  const [pesan, ubahPesan] = useState('Menghidupkan kamera…');
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [menyusun, ubahMenyusun] = useState(0);
  const [kirim, ubahKirim] = useState(false);
  const [beres, ubahBeres] = useState(false);
  const [percobaan, ubahPercobaan] = useState(0);
  const [status, ubahStatus] = useState<'cek' | 'terdaftar' | 'belum' | 'gagal'>('cek');
  const [tandaCek, ubahTandaCek] = useState(0);
  const [konfirmasiReset, ubahKonfirmasiReset] = useState(false);
  const [sandiReset, ubahSandiReset] = useState('');
  const [resetMemuat, ubahResetMemuat] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hentikanRef = useRef<(() => void) | null>(null);
  const setujuRef = useRef(setuju);
  setujuRef.current = setuju;
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
      gagalRef.current = true;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    } finally {
      kirimRef.current = false;
      ubahKirim(false);
    }
  }, [toast]);

  useEffect(() => {
    let hidup = true;
    api<{ terdaftar: boolean }>('/face/template')
      .then((r) => {
        if (hidup) ubahStatus(r.terdaftar ? 'terdaftar' : 'belum');
      })
      .catch(() => {
        if (hidup) ubahStatus('gagal');
      });
    return () => {
      hidup = false;
    };
  }, [tandaCek]);

  const resetTemplate = async () => {
    if (!sandiReset) {
      toast('Masukkan kata sandi untuk mengonfirmasi reset.', 'warn');
      return;
    }
    ubahResetMemuat(true);
    try {
      await api<{ pesan: string }>('/face/template', { method: 'DELETE', json: { kata_sandi: sandiReset } });
      ubahSandiReset('');
      ubahKonfirmasiReset(false);
      ubahBeres(false);
      ubahGalat(null);
      ubahPesan('Menghidupkan kamera…');
      ubahStatus('belum');
      toast('Template wajah dihapus. Silakan daftar ulang.');
    } catch (e) {
      const err = e as ApiError;
      toast(teksKode(err.kode ?? 'SERVER', err.message)[1], 'warn');
    } finally {
      ubahResetMemuat(false);
    }
  };

  useEffect(() => {
    if (status !== 'belum') return;
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
  }, [percobaan, status]);

  return (
    <>
      <JudulHalaman
        eyebrow="Peserta PKL"
        judul="Pendaftaran Wajah"
        sub={
          status === 'terdaftar'
            ? 'Wajah Anda sudah terdaftar. Anda dapat mendaftar ulang bila diperlukan.'
            : 'Daftarkan wajah sekali untuk verifikasi saat absensi.'
        }
      />

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <Kartu className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-garis">
            <div className="flex items-center gap-2">
              <span className="size-8 rounded-lg bg-pl text-pr grid place-items-center">
                <Ikon nama="camera" className="size-4" />
              </span>
              <b className="text-[12.5px] font-extrabold">Kamera pendaftaran</b>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[10px] font-semibold text-mu">
              <span className="size-1.5 rounded-full bg-[#15803d]" aria-hidden="true" />
              Deteksi lokal
            </span>
          </div>

          {status === 'cek' ? (
            <div className="flex items-center justify-center gap-2 px-4 py-14 text-[12px] text-mu">
              <Ikon nama="refresh" className="size-4 animate-spin" />
              Memeriksa status pendaftaran wajah…
            </div>
          ) : status === 'gagal' ? (
            <div className="px-4 py-10">
              <Pemberitahuan
                jenis="er"
                judul="Status wajah belum bisa dicek"
                uraian="Koneksi ke server terganggu. Kamera belum dibuka agar Anda tidak mendaftar ulang tanpa perlu."
              />
              <div className="mt-3 flex justify-center">
                <Tombol onClick={() => ubahTandaCek((n) => n + 1)}>
                  <Ikon nama="refresh" className="size-4" />
                  Coba lagi
                </Tombol>
              </div>
            </div>
          ) : status === 'terdaftar' ? (
            <div className="text-center px-4 py-10">
              <div className="size-20 rounded-full bg-[#dcfce7] text-[#15803d] grid place-items-center mx-auto mb-3">
                <Ikon nama="checkCircle" className="size-10" />
              </div>
              <b className="block text-lg font-extrabold mb-1">Wajah sudah terdaftar</b>
              <p className="text-mu text-[12px] max-w-[440px] mx-auto leading-relaxed">
                Template wajah Anda sudah aktif untuk verifikasi absensi. Reset template hanya jika wajah tidak
                terbaca lagi atau Anda ingin mendaftar ulang dari awal.
              </p>
              {!konfirmasiReset ? (
                <div className="mt-4 flex gap-2 justify-center flex-wrap">
                  <Tombol onClick={() => navigate('/absensi')}>Ke halaman absensi</Tombol>
                  <Tombol varian="gh" onClick={() => ubahKonfirmasiReset(true)}>
                    <Ikon nama="refresh" className="size-4" />
                    Reset template wajah
                  </Tombol>
                </div>
              ) : (
                <div
                  className="mt-5 max-w-[440px] mx-auto rounded-xl border border-y bg-[#fffbeb] px-4 py-3.5 text-left"
                  role="dialog"
                  aria-label="Konfirmasi reset template wajah"
                >
                  <b className="block text-[12px] text-y mb-1">Reset template wajah?</b>
                  <p className="text-[11px] text-[#6b5a2a] leading-relaxed">
                    Template lama akan dihapus, verifikasi/QR/tantangan yang belum terpakai dibatalkan. Setelah itu
                    Anda wajib mendaftar ulang lewat kamera.
                  </p>
                  <label htmlFor="reset_sandi" className="mt-3 block text-[11px] font-bold text-[#6b5a2a]">
                    Konfirmasi dengan kata sandi
                  </label>
                  <input
                    id="reset_sandi"
                    type="password"
                    autoComplete="current-password"
                    value={sandiReset}
                    onChange={(e) => ubahSandiReset(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && sandiReset && !resetMemuat) void resetTemplate(); }}
                    placeholder="Kata sandi akun Anda"
                    className="mt-1 block w-full h-[38px] px-3 border border-y rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#fcd34d]"
                  />
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <Tombol varian="dg2" onClick={resetTemplate} disabled={resetMemuat || !sandiReset}>
                      {resetMemuat ? 'Menghapus…' : 'Ya, hapus dan daftar ulang'}
                    </Tombol>
                    <Tombol varian="gh" onClick={() => { ubahSandiReset(''); ubahKonfirmasiReset(false); }} disabled={resetMemuat}>
                      Batal
                    </Tombol>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {galat ? (
                <div className="p-4 pb-0">
                  <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
                  <div className="mt-2">
                    <Tombol
                      varian="gh"
                      onClick={() => {
                        ubahGalat(null);
                        gagalRef.current = false;
                        ubahPesan('Menghidupkan kamera…');
                        ubahPercobaan((n) => n + 1);
                      }}
                    >
                      Coba lagi
                    </Tombol>
                  </div>
                </div>
              ) : null}

              {beres ? (
                <div className="text-center px-4 py-12">
                  <div className="size-20 rounded-full bg-[#dcfce7] text-[#15803d] grid place-items-center mx-auto mb-3">
                    <Ikon nama="checkCircle" className="size-10" />
                  </div>
                  <b className="block text-lg font-extrabold mb-1">Pendaftaran berhasil</b>
                  <p className="text-mu text-[12px] mb-4">Sekarang Anda bisa melakukan verifikasi wajah untuk absen.</p>
                  <Tombol onClick={() => navigate('/absensi')}>Ke halaman absensi</Tombol>
                </div>
              ) : (
                <>
                  <div className="kamera-latar p-4 md:p-6 grid place-items-center">
                    <div className="relative w-full max-w-[520px]">
                      <video
                        ref={videoRef}
                        className="block w-full h-auto rounded-xl border border-white/10 bg-black"
                        playsInline
                        muted
                      />
                      <div
                        aria-hidden="true"
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-[3px] border-[#93c5fd] rounded-[50%] w-[52%] h-[78%] pointer-events-none shadow-[0_0_0_999px_rgba(10,16,28,.28)]"
                      />
                      <div className="absolute left-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur px-2.5 py-1 text-[10px] font-semibold text-white">
                        <Ikon nama="face" className="size-3.5" />
                        Posisikan wajah di dalam bingkai
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3.5 border-t border-garis">
                    <p className="text-[12px] font-semibold" role="status" aria-live="polite">{pesan}</p>
                    <div className="flex items-center gap-2.5 mt-2">
                      <div className="h-1.5 flex-1 rounded-full bg-[#e2e8f0] overflow-hidden" aria-hidden="true">
                        <div
                          className="h-full bg-pr rounded-full transition-all"
                          style={{ width: `${Math.min(100, (menyusun / 12) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-mu whitespace-nowrap" aria-live="polite">
                        {menyusun}/12 sampel
                      </span>
                    </div>
                    {kirim ? (
                      <p className="text-[10.5px] text-mu mt-2 flex items-center gap-1.5">
                        <Ikon nama="refresh" className="size-3.5 animate-spin" />
                        Mengirim ke server…
                      </p>
                    ) : null}
                    {!setuju ? (
                      <p className="text-[10.5px] text-y font-semibold mt-2">
                        Centang persetujuan di samping agar pendaftaran dapat disimpan.
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </>
          )}
        </Kartu>

        <div>
          <Kartu t="Persetujuan dan privasi">
            <label
              className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                setuju ? 'border-[#bfdbfe] bg-[#f5f9ff]' : 'border-garis bg-[#fbfcfe]'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[#1d4ed8]"
                checked={setuju}
                onChange={(e) => setujuUlah(e.target.checked)}
              />
              <span className="text-[11.5px] leading-snug text-[#334155]">
                Saya setuju data wajah saya dipakai untuk pencocokan absensi (tersimpan terenkripsi).
              </span>
            </label>
            <p className="text-[11px] text-mu leading-relaxed mt-3">
              Deteksi berjalan di perangkat Anda: gambar wajah tidak pernah dikirim ke server. Yang disimpan
              hanya vektor angka (embedding, terenkripsi AES-256-GCM) untuk pencocokan.
            </p>
          </Kartu>

          <Kartu t="Tips pendaftaran">
            <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
              {[
                { i: 'face' as const, t: 'Hadap lurus ke kamera dengan wajah memenuhi bingkai.' },
                { i: 'image' as const, t: 'Pastikan pencahayaan cukup dan tidak ada wajah lain.' },
                { i: 'refresh' as const, t: 'Tahan posisi sampai 12 sampel terkumpul.' },
              ].map((x) => (
                <li key={x.t} className="flex items-start gap-2 text-[11px] text-[#4a5a72] leading-snug">
                  <Ikon nama={x.i} className="size-3.5 text-pr shrink-0 mt-0.5" />
                  <span>{x.t}</span>
                </li>
              ))}
            </ul>
          </Kartu>
        </div>
      </div>
    </>
  );
}
