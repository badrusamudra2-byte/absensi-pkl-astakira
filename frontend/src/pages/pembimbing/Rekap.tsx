import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import { ambilLokasiKantor, teksJarak } from '../../lib/kantor';
import type { Absensi, BarisJurnal } from '../../lib/tipe';

import { Kartu, JudulHalaman, Tombol, Pemberitahuan, Badge } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';
import PetaAbsensi, { warnaTitik } from '../../komponen/PetaAbsensi';

import { FxDaftar, FilterTanggal, gunakanTerbaru, isoHariIni, tglIndo, titikTerbaruBerlokasi } from '../../komponen/umum';
import { unduhBerkas, type FormatLaporan } from '../../lib/unduh';
import { Ikon } from '../../komponen/Ikon';

export default function Rekap() {
  const [sp] = useSearchParams();
  const [dari, ubahDari] = useState(isoHariIni().slice(0, 8) + '01');
  const [sampai, ubahSampai] = useState(isoHariIni());
  const [userPilih, ubahUserPilih] = useState<number | ''>(Number(sp.get('user_id')) || '');
  const [peserta, ubahPeserta] = useState<{ id: number; nama: string }[]>([]);
  const [absensi, ubahAbsensi] = useState<(Absensi & { peserta?: { id: number; nama: string } })[] | null>(null);
  const [jurnal, ubahJurnal] = useState<(BarisJurnal & { peserta?: { nama: string } })[] | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);

  const [sedangUnduh, ubahSedangUnduh] = useState(false);
  const toast = useToast();

  const [kantor, ubahKantor] = useState<{ lat: number; lng: number; radius_m: number } | null>(null);

  const terbaru = gunakanTerbaru();

  const unduh = async (format: FormatLaporan) => {
    ubahSedangUnduh(true);
    ubahGalat(null);
    try {
      const q = new URLSearchParams({ dari, sampai, ...(userPilih ? { user_id: String(userPilih) } : {}) });
      const nama = await unduhBerkas(`/pembimbing/rekap?${q}`, format, 'rekap-bimbingan');
      toast(`Laporan diunduh (${nama}).`);
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
    } finally {
      ubahSedangUnduh(false);
    }
  };

  useEffect(() => {
    void ambilLokasiKantor().then(ubahKantor);
  }, []);

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
      const r = await api<{ absensi: (Absensi & { peserta?: { id: number; nama: string } })[]; jurnal: (BarisJurnal & { peserta?: { nama: string } })[] }>(
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

  const jumlahHadir = absensi?.filter((a) => a.status === 'Hadir').length ?? null;
  const jumlahTerlambat = absensi?.filter((a) => a.status === 'Terlambat').length ?? null;

  const ringkas = [
    { label: 'Baris absensi', nilai: absensi?.length ?? null, ikon: 'absen' as const, warna: 'text-teks' },
    { label: 'Hadir', nilai: jumlahHadir, ikon: 'checkCircle' as const, warna: 'text-g' },
    { label: 'Terlambat', nilai: jumlahTerlambat, ikon: 'clock' as const, warna: 'text-y' },
    { label: 'Jurnal', nilai: jurnal?.length ?? null, ikon: 'book' as const, warna: 'text-pr' },
  ];

  return (
    <>
      <JudulHalaman
        eyebrow="Pembimbing"
        judul="Rekap periode"
        sub="Lihat absensi dan jurnal peserta bimbingan dalam rentang tanggal."
      />

      <Kartu t="Filter laporan">
        <FilterTanggal dari={dari} sampai={sampai} ubahDari={ubahDari} ubahSampai={ubahSampai} aksi={() => void muat()} />
        <div className="mt-3">
          <label htmlFor="pil_psr_rekap" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.04em] text-mu">
            Peserta (opsional)
          </label>
          <select
            id="pil_psr_rekap"
            value={userPilih}
            onChange={(e) => ubahUserPilih(e.target.value ? Number(e.target.value) : '')}
            className="h-[42px] w-full rounded-[11px] border border-garis bg-kartu px-3 text-sm outline-none transition focus:border-pr focus:ring-4 focus:ring-pr/10 sm:max-w-[360px]"
          >
            <option value="">Semua peserta bimbingan</option>
            {peserta.map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </div>
        {galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {([
            ['csv', 'CSV'],
            ['xlsx', 'Excel'],
            ['pdf', 'PDF'],
          ] as const).map(([format, label]) => (
            <Tombol key={format} varian="gh" onClick={() => void unduh(format)} disabled={sedangUnduh}>
              <Ikon nama="download" className="size-4" />
              Unduh {label}
            </Tombol>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-mu">
          <Ikon nama="info" className="mt-0.5 size-3.5 shrink-0" />
          Berkas mengikuti filter di atas dan hanya memuat peserta bimbingan Anda.
        </p>
      </Kartu>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ringkas.map((s) => (
          <div key={s.label} className="rounded-kartu border border-garis bg-kartu p-3.5 shadow-kartu">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9.5px] font-extrabold uppercase tracking-[.6px] text-mu">{s.label}</p>
              <Ikon nama={s.ikon} className="size-3.5 text-[#a9b6c8]" />
            </div>
            <p className={`mt-1.5 text-2xl font-extrabold leading-none ${s.warna}`}>{s.nilai ?? <span className="text-mu">…</span>}</p>
          </div>
        ))}
      </div>

      <Kartu t="Absensi">
        <FxDaftar
          rows={absensi}
          em="Belum ada absensi pada periode ini."
          kolom={[
            { t: 'Tanggal', isi: (a) => <span className="whitespace-nowrap font-semibold">{tglIndo(a.tanggal)}</span> },
            { t: 'Peserta', isi: (a) => a.peserta?.nama ?? '-' },
            { t: 'Jenis', isi: (a) => <b className="capitalize">{a.jenis}</b> },
            { t: 'Jam', isi: (a) => <span className="tabular-nums">{a.jam.slice(0, 5)}</span> },
            { t: 'Status', isi: (a) => <Badge s={a.status} /> },
            { t: 'Metode', isi: (a) => <span className="text-xs text-mu">{a.metode}</span> },
          ]}
        />
      </Kartu>

      <Kartu t="Peta absensi">
        {absensi && (absensi.some((a) => a.lat !== null && a.lng !== null) || kantor) ? (
          <>
            <PetaAbsensi
              kantor={kantor}
              titik={titikTerbaruBerlokasi(absensi)
                .map((a) => ({
                  lat: a.lat as number,
                  lng: a.lng as number,
                  jenis: a.jenis,
                  warna: warnaTitik(a.peserta?.id ?? a.user_id),
                  label:
                    `${a.peserta?.nama ?? 'Peserta'} — ${a.jenis} ${a.jam.slice(0, 5)}, ` +
                    `${tglIndo(a.tanggal)} (${teksJarak(a.jarak_m)} dari kantor)`,
                }))}
            />
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {titikTerbaruBerlokasi(absensi).map((a) => (
                <li key={a.id} className="flex items-center gap-1.5 text-xs text-mu">
                  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: warnaTitik(a.peserta?.id ?? a.user_id) }} />
                  {a.peserta?.nama ?? 'Peserta'}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex flex-col items-center px-4 py-7 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-pl text-pr">
              <Ikon nama="pin" className="size-5" />
            </span>
            <b className="mt-2.5 text-sm">Belum ada data lokasi</b>
            <p className="mt-1 max-w-[520px] text-xs leading-relaxed text-mu">
              Titik absensi muncul bila area kantor sudah diatur admin dan peserta mengirim lokasi saat absen.
              Hanya absen terbaru berlokasi per peserta yang ditampilkan, agar titik tidak menumpuk.
            </p>
          </div>
        )}
      </Kartu>

      <Kartu t="Jurnal kegiatan">
        <FxDaftar
          rows={jurnal}
          em="Belum ada jurnal pada periode ini."
          kolom={[
            { t: 'Tanggal', isi: (j) => <span className="whitespace-nowrap font-semibold">{tglIndo(j.tanggal)}</span> },
            { t: 'Peserta', isi: (j) => j.peserta?.nama ?? '-' },
            { t: 'Judul', isi: (j) => j.judul },
            { t: 'Status', isi: (j) => <Badge s={j.status} /> },
          ]}
        />
      </Kartu>
    </>
  );
}
