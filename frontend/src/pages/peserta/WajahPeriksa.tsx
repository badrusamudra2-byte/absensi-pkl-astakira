import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import { ambilLokasi, type TitikLokasi } from '../../lib/lokasi';
import { ambilLandmarker, cekKondisi, hitungEmbedding, keJpeg, MesinGerakan, PESAN_KONDISI } from '../../lib/wajah';
import type { Absensi, Jenis, StatusAbsensi, Tantangan, Pengaturan } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Badge } from '../../komponen/ui';
import { isoHariIni, penandaOtomatis } from '../../komponen/umum';
import { useOnline } from '../../komponen/Offline';

export default function WajahPeriksa() {
  const [cari] = useSearchParams();
  const jenis = (cari.get('jenis') === 'pulang' ? 'pulang' : 'masuk') as Jenis;
  // genap=scan : verifikasi wajah hanya membuka QR (mode qr_wajah) — foto wajah ikut dikirim
  // genap=langsung : absensi tercatat langsung dari halaman ini (mode wajah)
  const scan = cari.get('genap') === 'scan';
  const navigate = useNavigate();
  const daring = useOnline();

  const [pesan, ubahPesan] = useState('Memeriksa pendaftaran wajah…');
  const [instruksi, ubahInstruksi] = useState<string | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [maju, ubahMaju] = useState(0);
  const [tan, ubahTan] = useState<Tantangan | null>(null);
  const [livenessAktif, ubahLivenessAktif] = useState<boolean | null>(null);
  const [templateAda, ubahTemplateAda] = useState<boolean | null>(null);
  const [beres, ubahBeres] = useState<null | { jam: string; status: StatusAbsensi }>(null);
  const [kirim, ubahKirim] = useState(false);
  // Absensi jenis ini hari ini sudah tercatat -> verifikasi tidak dijalankan (undefined = belum diketahui)
  const [sudah, ubahSudah] = useState<Absensi | null | undefined>(undefined);
  // Hari ini tercatat Izin/Sakit (pengajuan disetujui) -> absensi dan verifikasi ditutup
  const [terkunciIzin, ubahTerkunciIzin] = useState<Absensi | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hentikanRef = useRef<(() => void) | null>(null);
  // Kondisi dikendalikan dari luar loop rAF (state dalam closure effect akan basi):
  const bawaan = useRef<{ tan: Tantangan | null; mesin: MesinGerakan | null; terkunci: boolean }>({
    tan: null, mesin: null, terkunci: false,
  });
  const kirimRef = useRef(false);
  const livenessRef = useRef<boolean | null>(null); // null = pengaturan belum diketahui
  // Pengaturan absensi: area kantor diatur -> posisi GPS dikirim bersama absensi wajah
  const kantorRef = useRef<{ lat: number; lng: number } | null>(null);
  const lurusRef = useRef(0); // hitung frame wajah lurus saat liveness mati
  const lusarRef = useRef<number[][]>([]); // buffer embedding wajah lurus untuk dirata-rata

  const mintaTantangan = useCallback(
    () => api<Tantangan>('/face/tantangan', { method: 'POST' }).then((t) => {
      ubahTan(t);
      ubahInstruksi(`Instruksi: ${t.instruksi}`);
      return t;
    }),
    [],
  );

  /** Selesai gerakan wajah -> kirim ke server (absensi langsung).
   * Saat liveness mati jac adalah null (tanpa nonce). */
  const kirimHasil = useCallback(
    async (jac: Tantangan | null, em: number[]) => {
      if (!navigator.onLine) {
        ubahGalat(['Tidak ada koneksi internet', 'Verifikasi wajah perlu server. Sambungkan internet lalu muat ulang halaman.']);
        hentikanRef.current?.();
        bawaan.current.terkunci = false;
        return;
      }
      kirimRef.current = true;
      ubahKirim(true);
      ubahGalat(null);
      // Foto diambil dulu dari frame kini (kamera masih menyala), lalu dikirim bersama data
      const foto = keJpeg(videoRef.current);
      try {
        if (scan) {
          // Mode qr_wajah: verifikasi wajah (termasuk foto untuk rekap) membuka QR lama 30 detik
          await api<{ pesan: string }>('/face/verify', {
            method: 'POST',
            json: { jenis, embedding: em, ...(jac ? { nonce: jac.nonce } : {}), ...(foto ? { foto } : {}) },
          });
          hentikanRef.current?.();
          navigate(`/absensi/qr?jenis=${jenis}`);
          return;
        }
        // Area kantor diatur: posisi GPS wajib dilaporkan — validasi jarak dilakukan server
        let lokasi: TitikLokasi | null = null;
        if (kantorRef.current) {
          try {
            lokasi = await ambilLokasi();
          } catch (e) {
            ubahGalat(['Lokasi dibutuhkan', (e as Error).message]);
            hentikanRef.current?.();
            return;
          }
        }
        const r = await api<{ pesan: string; jam: string; status: StatusAbsensi }>('/absensi/wajah', {
          method: 'POST',
          json: {
            jenis, embedding: em,
            ...(jac ? { nonce: jac.nonce } : {}),
            ...(foto ? { foto } : {}),
            ...(lokasi ? { lat: lokasi.lat, lng: lokasi.lng, akurasi_m: lokasi.akurasi_m } : {}),
          },
        });
        hentikanRef.current?.();
        ubahBeres({ jam: r.jam, status: r.status });
      } catch (e) {
        const err = e as ApiError;
        if (jac && err.kode?.startsWith('TANTANGAN_')) {
          // Tantangan basi: minta pasangan baru dan ganti mesin gerakan, lalu lanjutkan kamera
          try {
            const t = await mintaTantangan();
            bawaan.current = { tan: t, mesin: new MesinGerakan(t.kode_gerakan), terkunci: false };
          } catch (e2) {
            const e2a = e2 as ApiError;
            ubahGalat(teksKode(e2a.kode ?? 'SERVER', e2a.message));
            hentikanRef.current?.();
          }
        } else {
          const [judul, uraian] = teksKode(err.kode ?? 'SERVER', err.message);
          ubahGalat([judul, uraian]);
          hentikanRef.current?.();
        }
      } finally {
        kirimRef.current = false;
        ubahKirim(false);
        bawaan.current.terkunci = false;
        lurusRef.current = 0;
        lusarRef.current = [];
      }
    },
    [jenis, mintaTantangan, scan, navigate],
  );

  /* Pendaftaran wajah dicek ke server lebih dulu — pengukuran lokal saja tidak cukup.
     Riwayat hari ini juga dicek: bila absensi jenis ini sudah tercatat, verifikasi tidak perlu. */
  useEffect(() => {
    let hidup = true;
    api<{ terdaftar: boolean }>('/face/template')
      .then((r) => {
        if (!hidup) return;
        ubahTemplateAda(r.terdaftar);
        if (!r.terdaftar) {
          ubahGalat(teksKode('TEMPLATE_BELUM'));
          ubahPesan('');
        }
      })
      .catch(() => {
        // Gagal tahu status: lanjutkan; server akan menolak saat pengiriman bila memang belum ada
        if (hidup) ubahTemplateAda(true);
      });
    api<{ data: Absensi[] }>('/absensi/riwayat')
      .then((r) => {
        if (!hidup) return;
        // Hari terkunci Izin/Sakit ditangkap lebih dulu, jenis apa pun, agar kamera
        // tidak menyala dan peserta langsung melihat pesan pengajuannya.
        const izinHari = r.data.find(
          (x) => x.tanggal === isoHariIni() && (x.status === 'Izin' || x.status === 'Sakit'),
        ) ?? null;
        ubahTerkunciIzin(izinHari);
        // Penanda otomatis "Tidak hadir" bukan absensi nyata: peserta telat datang
        // tetap boleh memverifikasi; server mengganti penandanya saat absen.
        const cocok = r.data.find((x) => x.tanggal === isoHariIni() && x.jenis === jenis && !penandaOtomatis(x)) ?? null;
        ubahSudah(cocok);
        if (cocok || izinHari) {
          ubahPesan('');
          ubahGalat(null);
        }
      })
      .catch(() => {
        // Gagal diketahui: biarkan; server tetap menolak dobel saat pengiriman
        if (hidup) ubahSudah(null);
      });
    return () => {
      hidup = false;
    };
  }, []);

  /* Kamera + loop deteksi */
  useEffect(() => {
    let hidup = true;
    let raf = 0;
    // Tidak ada template, hari terkunci izin, atau absensi jenis ini sudah tercatat: kamera tidak perlu menyala
    if (templateAda !== true || sudah !== null || terkunciIzin !== null) return undefined;

    const mulai = async () => {
      try {
        const l = await ambilLandmarker();
        const aliran = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 } },
          audio: false,
        });
        if (!hidup) {
          aliran.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = aliran;
        await v.play();
        hentikanRef.current = () => aliran.getTracks().forEach((t) => t.stop());

        const bait = () => {
          if (!hidup) return;
          if (v.readyState >= 2) {
            const ts = performance.now();
            if (v.currentTime !== (v as HTMLVideoElement & { _ts?: number })._ts) {
              (v as HTMLVideoElement & { _ts?: number })._ts = v.currentTime;
              const res = l.detectForVideo(v, ts);
              const b = bawaan.current;
              if (livenessRef.current === null) {
                ubahPesan('Memuat pengaturan…');
              } else if (b.terkunci || kirimRef.current) {
                ubahPesan('Memeriksa server…');
              } else if (livenessRef.current) {
                if (!b.tan || !b.mesin) {
                  ubahPesan('Menyiapkan tantangan…');
                } else {
                  const kondis = cekKondisi(res, v);
                  if (kondis) {
                    ubahPesan(PESAN_KONDISI[kondis]);
                    ubahMaju(0);
                  } else {
                    const hasil = b.mesin.feed(res);
                    ubahMaju(hasil.maju);
                    ubahPesan(hasil.pesan ?? 'Jaga wajah di dalam bingkai…');
                    if (hasil.selesai) {
                      b.terkunci = true;
                      void kirimHasil(b.tan, hitungEmbedding(res.faceLandmarks![0]));
                    }
                  }
                }
              } else {
                // Liveness mati: cukup hadap lurus ke kamera selama beberapa frame
                const kondis = cekKondisi(res, v);
                if (kondis) {
                  ubahPesan(PESAN_KONDISI[kondis]);
                  lurusRef.current = 0;
                  lusarRef.current = [];
                  ubahMaju(0);
                } else {
                  const buf = lusarRef.current;
                  buf.push(hitungEmbedding(res.faceLandmarks![0]));
                  lurusRef.current += 1;
                  ubahMaju(Math.min(1, lurusRef.current / 10));
                  ubahPesan('Jaga wajah tetap di dalam bingkai, hadap lurus ke kamera…');
                  if (lurusRef.current >= 10) {
                    // Rata-rata 10 frame agar pengukuran stabil — satu frame mudah meleset
                    // melewati ambang kecocokan di server (template pendaftaran juga rata-rata).
                    const rata = buf[0].map((_, i) => buf.reduce((s, x) => s + x[i], 0) / buf.length);
                    buf.length = 0;
                    lurusRef.current = 0;
                    ubahMaju(0);
                    b.terkunci = true;
                    void kirimHasil(null, rata);
                  }
                }
              }
            }
          }
          raf = window.requestAnimationFrame(bait);
        };
        void bait();
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
  }, [templateAda, sudah, terkunciIzin]);

  /* Pengaturan liveness menentukan mode verifikasi (tantangan gerakan / wajah lurus). */
  useEffect(() => {
    let hidup = true;
    api<Pengaturan>('/pengaturan/absensi')
      .then((r) => {
        if (!hidup) return;
        ubahLivenessAktif(r.liveness_aktif);
        livenessRef.current = r.liveness_aktif;
        kantorRef.current =
          r.lat_kantor !== null && r.lng_kantor !== null ? { lat: r.lat_kantor, lng: r.lng_kantor } : null;
      })
      .catch(() => {
        // Gagal diketahui: pakai mode tantangan (perilaku bawaan server)
        if (hidup) {
          ubahLivenessAktif(true);
          livenessRef.current = true;
        }
      });
    return () => {
      hidup = false;
    };
  }, []);

  /* Tantangan pertama + mesin gerakan — hanya saat liveness aktif dan absensi jenis ini belum tercatat. */
  useEffect(() => {
    let hidup = true;
    if (!daring) {
      ubahGalat(['Tidak ada koneksi internet', 'Sambungkan Wi-Fi atau data seluler, tantangan wajah akan dimuat otomatis.']);
      ubahPesan('');
      return undefined;
    }
    if (sudah !== null && sudah !== undefined) return undefined; // sudah absen: verifikasi ditutup
    if (terkunciIzin !== null) return undefined; // hari terkunci izin/sakit: verifikasi ditutup
    if (livenessAktif !== true) {
      bawaan.current = { tan: null, mesin: null, terkunci: false };
      livenessRef.current = livenessAktif; // false = liveness mati, null = belum diketahui (loop menunggu)
      return undefined;
    }
    void mintaTantangan()
      .then((t) => {
        if (hidup) bawaan.current = { tan: t, mesin: new MesinGerakan(t.kode_gerakan), terkunci: false };
      })
      .catch((e) => {
        if (!hidup) return;
        const err = e as ApiError;
        ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
        ubahPesan('');
      });
    return () => {
      hidup = false;
    };
  }, [daring, mintaTantangan, livenessAktif, sudah, terkunciIzin]);

  const langsungBeres = beres !== null;

  return (
    <>
      <Kartu t={scan ? 'Verifikasi wajah untuk absen QR' : `Absen ${jenis} dengan wajah`}>
        {terkunciIzin ? (
          // Hari ini tercatat Izin/Sakit — tampilkan pengajuan peserta, bukan layar verifikasi
          <div className="text-center py-2">
            <div className="w-16 h-16 rounded-full bg-[#15803d20] text-g text-3xl leading-16 mx-auto mb-2">&#10003;</div>
            <h2 className="text-lg font-extrabold mb-2">Anda sudah mengajukan {terkunciIzin.status.toLowerCase()}</h2>
            <p>
              Hari ini tercatat <Badge s={terkunciIzin.status} /> &mdash; absensi tidak perlu dan tidak bisa dilakukan.
            </p>
            <div className="mt-3 flex gap-2 justify-center">
              <Tombol varian="gh" onClick={() => navigate('/riwayat')}>Lihat riwayat</Tombol>
              <Tombol onClick={() => navigate('/absensi')}>Selesai</Tombol>
            </div>
          </div>
        ) : galat ? (
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

        {langsungBeres && beres ? (
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
        ) : sudah !== null && sudah !== undefined ? (
          // Absensi jenis ini sudah tercatat hari ini — verifikasi & QR tidak dibuka lagi
          <div className="text-center py-2">
            <div className="w-16 h-16 rounded-full bg-[#15803d20] text-g text-3xl leading-16 mx-auto mb-2">&#10003;</div>
            <h2 className="text-lg font-extrabold mb-2">Absensi {jenis} sudah tercatat</h2>
            <p>
              Tercatat <b aria-live="polite">{sudah.jam.slice(0, 5)}</b> &mdash; <Badge s={sudah.status} />
            </p>
            <p className="text-mu text-sm mt-1">Cukup sekali absen per jenis per hari.</p>
            <div className="mt-3 flex gap-2 justify-center">
              <Tombol varian="gh" onClick={() => navigate('/riwayat')}>Lihat riwayat</Tombol>
              <Tombol onClick={() => navigate('/absensi')}>Selesai</Tombol>
            </div>
          </div>
        ) : templateAda === false ? null : (
          <>
            <div className="relative w-fit mx-auto">
              <video ref={videoRef} className="rounded-xl border border-garis bg-black max-w-full" playsInline muted />
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-pr rounded-[50%] w-[min(60vw,240px)] h-[min(78vw,310px)] pointer-events-none"
              />
            </div>
            <p className="mt-2 font-bold" role="status" aria-live="polite">{instruksi ?? ''}</p>
            <p className="text-mu text-sm mt-1" aria-live="polite">{pesan}</p>
            <div className="h-1.5 max-w-[460px] bg-[#0f172a20] rounded mt-2 overflow-hidden" aria-hidden="true">
              <div className="h-full bg-pr rounded transition-all" style={{ width: `${maju * 100}%` }} />
            </div>
            <p className="text-xs text-mu mt-2">
              Kamera aktif hanya selama halaman ini dibuka.{livenessAktif ? ' Instruksi berubah setiap tantangan baru.' : ' Tanpa instruksi gerakan — cukup wajah lurus.'}
              {scan ? ' Begitu verifikasi lolos, QR absensi Anda ditayangkan untuk dipindai pembimbing.' : ''}
            </p>
          </>
        )}
      </Kartu>
    </>
  );
}
