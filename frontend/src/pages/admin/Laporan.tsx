import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { LaporanData } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Label, Badge } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';
import { FxDaftar, FilterTanggal, gunakanTerbaru, isoHariIni, tglIndo } from '../../komponen/umum';
import { unduhBerkas, type FormatLaporan } from '../../lib/unduh';

type Tab = 'rekap' | 'absensi' | 'jurnal';

const TAB: { id: Tab; label: string }[] = [
  { id: 'rekap', label: 'Rekap per peserta' },
  { id: 'absensi', label: 'Absensi' },
  { id: 'jurnal', label: 'Jurnal' },
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
      <Kartu t="Laporan absensi & jurnal">
        <FilterTanggal dari={dari} sampai={sampai} ubahDari={ubahDari} ubahSampai={ubahSampai} aksi={() => void muat(dari, sampai, uid)} />
        <p className="mt-3">
          <Label htmlFor="lap_psr">Peserta (opsional)</Label>
          <select
            id="lap_psr"
            value={uid}
            onChange={(e) => {
              const u = e.target.value ? Number(e.target.value) : '';
              ubahUid(u);
              void muat(dari, sampai, u);
            }}
            className="px-[11px] py-2 border border-garis rounded-lg bg-bg max-w-full"
          >
            <option value="">— semua peserta —</option>
            {peserta.map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </p>
        {galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}

        <p className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Bagian laporan">
          {TAB.map((t) => (
            <Tombol
              key={t.id}
              varian={tab === t.id ? 'utama' : 'gh'}
              onClick={() => ubahTab(t.id)}
              aria-pressed={tab === t.id}
            >
              {t.label}
            </Tombol>
          ))}
        </p>
      </Kartu>

      <Kartu t="Unduh laporan">
        <p className="text-mu text-sm mb-3">Berkas mengikuti filter di atas (rentang dan peserta).</p>
        <p className="flex flex-wrap gap-2">
          <Tombol varian="gh" onClick={() => void unduh('csv')} disabled={sedang}>Unduh CSV</Tombol>
          <Tombol varian="gh" onClick={() => void unduh('xlsx')} disabled={sedang}>Unduh Excel</Tombol>
          <Tombol varian="gh" onClick={() => void unduh('pdf')} disabled={sedang}>Unduh PDF</Tombol>
        </p>
        <p className="text-mu text-xs mt-3">CSV, Excel, dan PDF memuat tiga bagian: Rekap per peserta, Absensi, dan Jurnal.</p>
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
                isi: (k) => `${k.jurnal_disetujui}/${k.jurnal_dikirim}/${k.jurnal_revisi}`,
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
              { t: 'Tanggal', utama: (a) => tglIndo(a.tanggal), isi: (a) => tglIndo(a.tanggal) },
              { t: 'Peserta', isi: (a) => a.peserta?.nama ?? '-' },
              { t: 'Jenis', isi: (a) => <b className="capitalize">{a.jenis}</b> },
              { t: 'Jam', isi: (a) => a.jam.slice(0, 5) },
              { t: 'Status', isi: (a) => (a.status === 'Tidak hadir' && a.metode === 'Otomatis' ? <span className="text-mu">Penanda otomatis</span> : <Badge s={a.status} />) },
              { t: 'Metode', isi: (a) => a.metode },
            ]}
          />
        </Kartu>
      ) : null}

      {tab === 'jurnal' ? (
        <Kartu t="Baris jurnal">
          <FxDaftar
            rows={data?.jurnal ?? null}
            kolom={[
              { t: 'Tanggal', utama: (j) => tglIndo(j.tanggal), isi: (j) => tglIndo(j.tanggal) },
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
