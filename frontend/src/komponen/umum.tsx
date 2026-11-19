import { useCallback, useRef, type ReactNode } from 'react';
import type { Absensi, Jenis } from '../lib/tipe';
import { Ikon } from './Ikon';

/** Baris "Tidak hadir" (metode Otomatis) dari job tutup hari hanyalah penanda,
 * bukan absensi sungguhan — peserta telat datang tetap bisa absen dan penanda
 * diganti absensi nyata oleh server. */
export const penandaOtomatis = (a: Absensi | null | undefined) =>
  !!a && a.status === 'Tidak hadir' && a.metode === 'Otomatis';

/** Absensi satu baris per hari: data pulang ada di pulang_jam/pulang_status
 * baris masuk yang sama. Kembalikan { jam, status } bila jenis itu sudah
 * tercatat pada tanggal itu (penanda otomatis tidak dihitung), atau null bila
 * belum. Baris Izin/Sakit ikut terbaca sebagai tercatat untuk jenisnya. */
export const tercatatPada = (
  rows: Absensi[],
  tanggal: string,
  jenis: Jenis,
): { jam: string; status: Absensi['status'] } | null => {
  const baris = rows.find((x) => x.tanggal === tanggal && !penandaOtomatis(x));
  if (!baris) return null;
  if (jenis === 'masuk') return { jam: baris.jam, status: baris.status };
  return baris.pulang_jam && baris.pulang_status
    ? { jam: baris.pulang_jam, status: baris.pulang_status }
    : null;
};

/** Format "2026-10-17" menjadi "Jumat, 17/10/2026". */
export const tglIndo = (s: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jakarta' })
    .format(new Date(`${s}T12:00:00+07:00`));

/** Format "2026-10-17" singkat "17/10". */
export const tglPendek = (s: string) => s.slice(8, 10) + '/' + s.slice(5, 7);

/** Format ISO UTC dari server menjadi "17/10/2026 09.30" WIB.
 * ISO UTC dipotong mentah akan meleset 7 jam (db menyimpan UTC, aplikasi WIB). */
export const waktuWib = (iso?: string | null) => {
  if (!iso) return '-';
  const f = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  }).formatToParts(new Date(iso));
  const bagi = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  return `${bagi('day')}/${bagi('month')}/${bagi('year')} ${bagi('hour')}.${bagi('minute')}`;
};

export const isoHariIni = () => new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 10);

/** Tanggal WIB "geser" hari silam: "2026-11-10" (geser 0), "2026-11-03" (geser 7). */
export const isoHariSilam = (geser: number) =>
  new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Jakarta' }).format(new Date(Date.now() - geser * 86400000)).slice(0, 10);

/** Penjaga respons basi: tiap pemanggilan menaikkan nomor urut dan kembalikan
 * fungsi pemeriksa. Respons yang mulai lebih dulu (selesai belakangan) tak lagi
 * menimpa data filter terbaru. Pakai: const sah = terbaru(); ... if (sah(true)) set... */
export function gunakanTerbaru() {
  const nomor = useRef(0);
  return useCallback(() => {
    const n = ++nomor.current;
    return (masih: boolean) => masih && nomor.current === n;
  }, []);
}

/** Untuk peta: satu titik terbaru per peserta dari baris yang punya koordinat.
 * Tanpa ini marker menumpuk di koordinat yang sama (kantor) untuk tiap absen
 * sepanjang periode dan terlihat seperti titik duplikat. Baris dikunci per
 * user_id (tersedia pada daftar rekap dan daftar admin). */
export const titikTerbaruBerlokasi = <
  T extends { user_id?: number; tanggal: string; jam: string; lat?: number | null; lng?: number | null },
>(rows: T[]): T[] => {
  const terpilih = new Map<number, T>();
  for (const a of rows) {
    if (a.lat === null || a.lat === undefined || a.lng === null || a.lng === undefined) continue;
    const kunci = a.user_id ?? 0;
    const lama = terpilih.get(kunci);
    if (!lama || a.tanggal > lama.tanggal || (a.tanggal === lama.tanggal && a.jam > lama.jam)) {
      terpilih.set(kunci, a);
    }
  }
  return [...terpilih.values()];
};

export function FilterTanggal({
  dari, sampai, ubahDari, ubahSampai, aksi, sedang,
}: {
  dari: string; sampai: string;
  ubahDari: (v: string) => void; ubahSampai: (v: string) => void;
  aksi: () => void; sedang?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <label htmlFor="f_dari" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-mu">Dari tanggal</label>
        <input id="f_dari" type="date" value={dari} onChange={(e) => ubahDari(e.target.value)}
          className="h-[42px] w-full rounded-[11px] border border-garis bg-kartu px-3 text-sm outline-none transition focus:border-pr focus:ring-4 focus:ring-pr/10" />
      </div>
      <div>
        <label htmlFor="f_sampai" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-mu">Sampai tanggal</label>
        <input id="f_sampai" type="date" value={sampai} onChange={(e) => ubahSampai(e.target.value)}
          className="h-[42px] w-full rounded-[11px] border border-garis bg-kartu px-3 text-sm outline-none transition focus:border-pr focus:ring-4 focus:ring-pr/10" />
      </div>
      <button onClick={aksi} disabled={sedang}
        className="inline-flex h-[42px] items-center justify-center gap-2 rounded-[11px] border border-pr bg-pr px-4 text-sm font-bold text-pr-t shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">
        <Ikon nama="search" className="h-4 w-4" />
        Tampilkan
      </button>
    </div>
  );
}

type Kolom<T> = {
  t: string;
  /** Nilai utama (dijadikan judul kartu di HP). */
  utama?: (b: T) => ReactNode;
  isi: (b: T) => ReactNode;
};

/** Tabel di desktop; menjadi daftar kartu di layar sempit (< 640px). */
export function FxDaftar<T>({ kolom, rows, em = 'Tidak ada data pada rentang ini.' }: { kolom: Kolom<T>[]; rows: T[] | null; em?: string }) {
  if (rows === null) {
    return (
      <p className="flex items-center gap-2 py-3 text-sm text-mu">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-pr/25 border-t-pr" aria-hidden="true" />
        Memuat data&hellip;
      </p>
    );
  }
  if (!rows.length) {
    return (
      <div className="rounded-[12px] border border-dashed border-garis px-4 py-8 text-center">
        <p className="text-sm text-mu">{em}</p>
      </div>
    );
  }

  return (
    <>
      {/* Tabel desktop */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="bg-[#f8fafc]">
              {kolom.map((k) => (
                <th key={k.t} className="border-b border-garis px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-mu">{k.t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr key={i} className="transition-colors hover:bg-[#f8fafc]/70">
                {kolom.map((k, j) => (
                  <td key={j} className="border-b border-garis/70 px-3 py-3 align-top text-sm last:border-b-0">{k.isi(b)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Kartu HP */}
      <ul className="flex flex-col gap-3 sm:hidden">
        {rows.map((b, i) => (
          <li key={i} className="rounded-[13px] border border-garis bg-kartu p-3.5">
            <div className="mb-2 border-b border-garis/70 pb-2 text-sm font-bold">
              {kolom[0].utama ? kolom[0].utama(b) : kolom[0].isi(b)}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              {kolom.slice(1).map((k) => (
                <div key={k.t} className="contents">
                  <dt className="pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-mu">{k.t}</dt>
                  <dd>{k.isi(b)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
