import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { LaporanData } from '../../lib/tipe';
import { Kartu, JudulHalaman, Tombol, Pemberitahuan, Badge } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';
import { FxDaftar, FilterTanggal, gunakanTerbaru, isoHariIni, tglIndo } from '../../komponen/umum';
import { unduhBerkas, type FormatLaporan } from '../../lib/unduh';
import { Ikon } from '../../komponen/Ikon';

type Tab = 'rekap' | 'absensi' | 'jurnal';

const TAB: { id: Tab; label: string; ikon: 'chart' | 'absen' | 'book' }[] = [
  { id: 'rekap', label: 'Rekap per peserta', ikon: 'chart' },
  { id: 'absensi', label: 'Absensi', ikon: 'absen' },
  { id: 'jurnal', label: 'Jurnal', ikon: 'book' },
];

const jumlah = (n: number) => (n === 0 ? '0' : <b>{n}</b>);

/** Laporan admin: rekap kehadiran + jurnal per periode, dapat difilter dan diunduh (CSV/Excel/PDF). */
export default function Laporan() {
  const toast = useToast();
  const [dari, ubahDari] = useState(isoHariIni().slice(0, 8) + '01');
  const [sampai, ubahSampai] = useState(isoHariIni());
  const [uid, ubahUid] = useState<number | ''>('');
  const [peserta, ubahPeserta] = useState<{ id: number; nama: string }[]>([]);
  const [tab, ubahTab] = useState<Tab>('rekap');
  const [data, ubahData] = useState<LaporanData | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [sedang, ubahSedang] = useState(false);
  const terbaru = gunakanTerbaru();

  useEffect(() => {
    api<{ data: { id: number; nama: string }[] }>('/admin/peserta')
      .then((r) => ubahPeserta(r.data.map((p) => ({ id: p.id, nama: p.nama }))))
      .catch((e) => ubahGalat(teksKode((e as ApiError).kode ?? 'SERVER', (e as ApiError).message)));
  }, []);

  const muat = useCallback(async (d: string, s: string, u: number | '') => {
    const sah = terbaru();
    ubahData(null);
    ubahGalat(null);
    try {
      const q = new URLSearchParams({ dari: d, sampai: s, ...(u ? { user_id: String(u) } : {}) });
      const r = await api<LaporanData>(`/admin/laporan?${q}`);
      if (sah(true)) ubahData(r);
    } catch (e) {
      if (!sah(true)) return;
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    }
  }, [terbaru]);

  // Muat pertama sekali (rentang bawaan: bulan berjalan)
  useEffect(() => {
    void muat(isoHariIni().slice(0, 8) + '01', isoHariIni(), '');
  }, [muat]);

  const unduh = async (format: FormatLaporan) => {
    ubahSedang(true);
    ubahGalat(null);
    try {
      const q = new URLSearchParams({ dari, sampai, ...(uid ? { user_id: String(uid) } : {}) });
      const nama = await unduhBerkas(`/admin/laporan?${q}`, format, 'laporan-absensi');
      toast(`Laporan diunduh (${nama}).`);
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    } finally {
      ubahSedang(false);
    }
  };

  return (
    <>
      <JudulHalaman
        eyebrow="Admin"
        judul="Laporan"
        sub="Rekap kehadiran dan jurnal per periode, siap diunduh."
      />

      <Kartu t="Filter laporan">
        <FilterTanggal dari={dari} sampai={sampai} ubahDari={ubahDari} ubahSampai={ubahSampai} aksi={() => void muat(dari, sampai, uid)} />
        <div className="mt-3">
          <label htmlFor="lap_psr" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-mu">
            Peserta (opsional)
          </label>
          <select
            id="lap_psr"
            value={uid}
            onChange={(e) => {
              const u = e.target.value ? Number(e.target.value) : '';
              ubahUid(u);
              void muat(dari, sampai, u);
            }}
            className="h-[42px] w-full rounded-[11px] border border-garis bg-kartu px-3 text-sm outline-none transition focus:border-pr focus:ring-4 focus:ring-pr/10 sm:max-w-[360px]"
          >
            <option value="">— semua peserta —</option>
            {peserta.map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </div>

        {galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Bagian laporan">
          {TAB.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => ubahTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                tab === t.id
                  ? 'border-pr bg-pr text-white shadow-sm'
                  : 'border-garis bg-kartu text-mu hover:border-pr/50 hover:text-pr'
              }`}
            >
              <Ikon nama={t.ikon} className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-garis pt-3">
          <span className="mr-1 text-[10px] font-extrabold uppercase tracking-[.6px] text-mu">Unduh</span>
          {([
            ['csv', 'CSV'],
            ['xlsx', 'Excel'],
            ['pdf', 'PDF'],
          ] as const).map(([format, label]) => (
            <Tombol key={format} varian="gh" onClick={() => void unduh(format)} disabled={sedang}>
              <Ikon nama="download" className="size-4" />
              {label}
            </Tombol>
          ))}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-mu">
          <Ikon nama="info" className="mt-0.5 size-3.5 shrink-0" />
          Berkas mengikuti filter di atas dan memuat tiga bagian: rekap per peserta, absensi, dan jurnal.
        </p>
      </Kartu>

      {tab === 'rekap' ? (
        <Kartu t="Rekap per peserta">
          <FxDaftar
            rows={data?.rekap ?? null}
            kolom={[
              { t: 'Peserta', utama: (k) => k.nama, isi: (k) => <b>{k.nama}</b> },
              { t: 'Hadir', isi: (k) => jumlah(k.hadir) },
              { t: 'Terlambat', isi: (k) => jumlah(k.terlambat) },
              { t: 'Izin', isi: (k) => jumlah(k.izin) },
              { t: 'Sakit', isi: (k) => jumlah(k.sakit) },
              { t: 'Tidak hadir', isi: (k) => jumlah(k.tidak_hadir) },
              {
                t: 'Jurnal (Disetujui/Dikirim/Revisi)',
                isi: (k) => <span className="whitespace-nowrap tabular-nums">{k.jurnal_disetujui}/{k.jurnal_dikirim}/{k.jurnal_revisi}</span>,
              },
            ]}
          />
        </Kartu>
      ) : null}

      {tab === 'absensi' ? (
        <Kartu t="Baris absensi">
          <FxDaftar
            rows={data?.absensi ?? null}
            kolom={[
              { t: 'Tanggal', utama: (a) => tglIndo(a.tanggal), isi: (a) => <span className="whitespace-nowrap font-semibold">{tglIndo(a.tanggal)}</span> },
              { t: 'Peserta', isi: (a) => a.peserta?.nama ?? '-' },
              { t: 'Jenis', isi: (a) => <b className="capitalize">{a.jenis}</b> },
              { t: 'Jam', isi: (a) => <span className="tabular-nums">{a.jam.slice(0, 5)}</span> },
              { t: 'Status', isi: (a) => (a.status === 'Tidak hadir' && a.metode === 'Otomatis' ? <span className="text-mu">Penanda otomatis</span> : <Badge s={a.status} />) },
              { t: 'Metode', isi: (a) => <span className="text-xs text-mu">{a.metode}</span> },
            ]}
          />
        </Kartu>
      ) : null}

      {tab === 'jurnal' ? (
        <Kartu t="Baris jurnal">
          <FxDaftar
            rows={data?.jurnal ?? null}
            kolom={[
              { t: 'Tanggal', utama: (j) => tglIndo(j.tanggal), isi: (j) => <span className="whitespace-nowrap font-semibold">{tglIndo(j.tanggal)}</span> },
              { t: 'Peserta', isi: (j) => j.peserta?.nama ?? '-' },
              { t: 'Judul', isi: (j) => <b>{j.judul}</b> },
              { t: 'Status', isi: (j) => <Badge s={j.status} /> },
            ]}
          />
        </Kartu>
      ) : null}
    </>
  );
}
