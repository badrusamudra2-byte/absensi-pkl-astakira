import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import { ambilLokasi } from '../lib/lokasi';
import { useAuth } from './Auth';
import type { StatusLive } from '../lib/tipe';

/* Live tracking (tahap 2) sisi peserta, seluruh logika sesi ditentukan server:
 * - Banner persetujuan bila peserta belum pernah setuju (PUT /live/izin).
 * - Selama sesi aktif (antara absen masuk dan absen pulang), posisi dikirim
 *   berkala (±45 detik) ke POST /live/posisi; hanya posisi terakhir disimpan.
 * - Sesi ditutup server saat absen pulang / job otomatis; pengiriman berhenti. */

// Selaras dengan ambang PUTUS_SEKON=120 dan rate limit 3 permintaan/2 menit.
const SEKON_KIRIM = 45;
const SEKON_STATUS = 60;

interface KonteksLive {
  /** null = status belum diketahui; false = banner tampil; true = sudah setuju */
  setuju: boolean | null;
  sesiAktif: boolean;
}

const Ctx = createContext<KonteksLive | null>(null);

export const useLive = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLive harus dipakai di dalam LiveProvider');
  return v;
};

export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [setuju, ubahSetuju] = useState<boolean | null>(null);
  const [sesiAktif, ubahSesiAktif] = useState(false);
  const [sembunyi, ubahSembunyi] = useState(false); // "Nanti": banner ditutup untuk sesi tab ini
  const [sedangIzin, ubahSedangIzin] = useState(false);
  const [galatIzin, ubahGalatIzin] = useState<string | null>(null);
  const hidupRef = useRef(true);
  const sesiRef = useRef(false);

  const peserta = user?.role === 'peserta';

  // Muat status sesi terkini dari server (sumber kebenaran satu-satunya).
  const segarkan = useCallback(async () => {
    if (!peserta) return;
    try {
      const r = await api<StatusLive>('/live/status');
      ubahSetuju(r.setuju);
      sesiRef.current = !!r.sesi;
      ubahSesiAktif(!!r.sesi);
    } catch {
      /* status gagal dibaca: biarkan nilai sebelumnya, polling lanjut */
    }
  }, [peserta]);

  useEffect(() => {
    hidupRef.current = true;
    ubahSetuju(null);
    ubahSesiAktif(false);
    ubahSembunyi(false);
    if (!peserta) return undefined;
    void segarkan();
    const status = setInterval(() => void segarkan(), SEKON_STATUS * 1000);
    return () => {
      hidupRef.current = false;
      clearInterval(status);
    };
  }, [peserta, segarkan, user?.id]);

  // Pengirim posisi: hanya saat sesi aktif menurut server. Jika server menolak
  // (sesi sudah ditutup — 409 LIVE_TIDAK_AKTIF), berhenti dan muat ulang status.
  useEffect(() => {
    if (!peserta || !sesiAktif || !setuju) return undefined;
    let timer: ReturnType<typeof setInterval> | null = null;

    const kirim = async () => {
      try {
        const titik = await ambilLokasi();
        if (!hidupRef.current || !sesiRef.current) return;
        await api('/live/posisi', {
          method: 'POST',
          json: { lat: titik.lat, lng: titik.lng, akurasi_m: titik.akurasi_m },
        });
      } catch (e) {
        if (e instanceof ApiError && e.kode === 'LIVE_TIDAK_AKTIF') {
          sesiRef.current = false;
          ubahSesiAktif(false); // sesi ditutup server: berhenti mengirim
          return;
        }
        /* galat lain (GPS buruk, jaringan): lewati siklus ini, coba lagi nanti */
      }
    };

    void kirim(); // posisi pertama segera saat sesi baru aktif
    timer = setInterval(() => void kirim(), SEKON_KIRIM * 1000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [peserta, sesiAktif, setuju]);

  const izinkan = async () => {
    ubahSedangIzin(true);
    ubahGalatIzin(null);
    try {
      await api('/live/izin', { method: 'PUT' });
      ubahSetuju(true);
      await segarkan(); // sesi bisa langsung dibuka bila sedang jam kerja
    } catch (e) {
      const err = e as ApiError;
      ubahGalatIzin(err.message);
    } finally {
      ubahSedangIzin(false);
    }
  };

  return (
    <Ctx.Provider value={{ setuju, sesiAktif }}>
      {children}
      {peserta && setuju === false && !sembunyi ? (
        <div
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[460px] bg-kartu border border-garis rounded-xl p-4 shadow-lg"
          role="region"
          aria-label="Persetujuan pelacakan lokasi"
        >
          <b className="block mb-1">Izinkan pelacakan lokasi?</b>
          <p className="text-sm text-mu">
            Selama jam kerja (dari absen masuk sampai absen pulang) posisi terakhir perangkat Anda
            dilaporkan ke pembimbing untuk keselamatan. Riwayat tidak disimpan — hanya titik terkini.
          </p>
          {galatIzin ? <p className="text-r text-sm font-semibold mt-1" role="alert">{galatIzin}</p> : null}
          <p className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => void izinkan()}
              disabled={sedangIzin}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-pr border-pr text-pr-t cursor-pointer hover:brightness-110 disabled:opacity-60"
            >
              {sedangIzin ? 'Menyimpan&hellip;' : 'Izinkan'}
            </button>
            <button
              type="button"
              onClick={() => ubahSembunyi(true)}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-transparent text-pr border-garis cursor-pointer hover:brightness-110"
            >
              Nanti
            </button>
          </p>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}
