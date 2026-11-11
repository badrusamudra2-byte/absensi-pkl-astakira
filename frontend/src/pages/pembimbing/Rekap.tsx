import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { Absensi, BarisJurnal } from '../../lib/tipe';
import { Kartu, Pemberitahuan, Badge } from '../../komponen/ui';
import { FxDaftar, FilterTanggal, gunakanTerbaru, isoHariIni, tglIndo } from '../../komponen/umum';

export default function Rekap() {
  const [sp] = useSearchParams();
  const [dari, ubahDari] = useState(isoHariIni().slice(0, 8) + '01');
  const [sampai, ubahSampai] = useState(isoHariIni());
  const [userPilih, ubahUserPilih] = useState<number | ''>(Number(sp.get('user_id')) || '');
  const [peserta, ubahPeserta] = useState<{ id: number; nama: string }[]>([]);
  const [absensi, ubahAbsensi] = useState<(Absensi & { peserta?: { nama: string } })[] | null>(null);
  const [jurnal, ubahJurnal] = useState<(BarisJurnal & { peserta?: { nama: string } })[] | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const terbaru = gunakanTerbaru();

  useEffect(() => {
    api<{ data: { id: number; nama: string }[] }>('/pembimbing/peserta')
      .then((r) => ubahPeserta(r.data.map((p) => ({ id: p.id, nama: p.nama }))))
      .catch(() => ubahPeserta([]));
  }, []);

  const muat = useCallback(async () => {
    const sah = terbaru();
    ubahAbsensi(null);
    ubahJurnal(null);
    ubahGalat(null);
    try {
      const q = new URLSearchParams({ dari, sampai, ...(userPilih ? { user_id: String(userPilih) } : {}) });
      const r = await api<{ absensi: (Absensi & { peserta?: { nama: string } })[]; jurnal: (BarisJurnal & { peserta?: { nama: string } })[] }>(
        `/pembimbing/rekap?${q}`,
      );
      if (!sah(true)) return;
      ubahAbsensi(r.absensi);
      ubahJurnal(r.jurnal);
    } catch (e) {
      if (!sah(true)) return;
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    }
  }, [dari, sampai, userPilih, terbaru]);

  useEffect(() => {
    void muat();
  }, [muat]);

  return (
    <>
      <Kartu t="Rekap berdasarkan periode">
        <FilterTanggal dari={dari} sampai={sampai} ubahDari={ubahDari} ubahSampai={ubahSampai} aksi={() => void muat()} />
        <p className="mt-3">
          <label htmlFor="pil_psr_rekap" className="block text-[13px] font-semibold mb-1">Peserta (opsional)</label>
          <select
            id="pil_psr_rekap"
            value={userPilih}
            onChange={(e) => ubahUserPilih(e.target.value ? Number(e.target.value) : '')}
            className="px-[11px] py-2 border border-garis rounded-lg bg-bg"
          >
            <option value="">Semua peserta bimbingan</option>
            {peserta.map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </p>
        {galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
      </Kartu>

      <Kartu t="Absensi">
        <FxDaftar
          rows={absensi}
          kolom={[
            { t: 'Tanggal', isi: (a) => tglIndo(a.tanggal) },
            { t: 'Peserta', isi: (a) => a.peserta?.nama ?? '-' },
            { t: 'Jenis', isi: (a) => <b className="capitalize">{a.jenis}</b> },
            { t: 'Jam', isi: (a) => a.jam.slice(0, 5) },
            { t: 'Status', isi: (a) => <Badge s={a.status} /> },
            { t: 'Metode', isi: (a) => a.metode },
          ]}
        />
      </Kartu>

      <Kartu t="Jurnal kegiatan">
        <FxDaftar
          rows={jurnal}
          kolom={[
            { t: 'Tanggal', isi: (j) => tglIndo(j.tanggal) },
            { t: 'Peserta', isi: (j) => j.peserta?.nama ?? '-' },
            { t: 'Judul', isi: (j) => j.judul },
            { t: 'Status', isi: (j) => <Badge s={j.status} /> },
          ]}
        />
      </Kartu>
    </>
  );
}
