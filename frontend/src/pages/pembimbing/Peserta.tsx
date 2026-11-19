import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { BarisPesertaPembimbing, StatusAbsensi } from '../../lib/tipe';
import { Kartu, JudulHalaman, Pemberitahuan, Badge } from '../../komponen/ui';
import { FxDaftar } from '../../komponen/umum';
import { Ikon } from '../../komponen/Ikon';

const REKAP: StatusAbsensi[] = ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Tidak hadir'];

export default function Peserta() {
  const [rows, ubahRows] = useState<BarisPesertaPembimbing[] | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);

  useEffect(() => {
    api<{ data: BarisPesertaPembimbing[] }>('/pembimbing/peserta')
      .then((r) => ubahRows(r.data))
      .catch((e) => ubahGalat(teksKode((e as ApiError).kode ?? 'SERVER', (e as ApiError).message)));
  }, []);

  const aktif = rows?.filter((b) => b.aktif).length ?? null;

  return (
    <>
      <JudulHalaman
        eyebrow="Pembimbing"
        judul="Peserta bimbingan"
        sub="Daftar peserta yang Anda dampingi beserta rekap 30 hari terakhir."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-kartu border border-garis bg-kartu p-4 shadow-kartu">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pl text-pr">
            <Ikon nama="users" className="size-5" />
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[1px] text-mu">Total peserta</p>
            <p className="text-2xl font-extrabold leading-tight">{rows?.length ?? '…'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-kartu border border-garis bg-kartu p-4 shadow-kartu">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#15803d18] text-g">
            <Ikon nama="checkCircle" className="size-5" />
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[1px] text-mu">Peserta aktif</p>
            <p className="text-2xl font-extrabold leading-tight text-g">{aktif ?? '…'}</p>
          </div>
        </div>
      </div>

      <Kartu t="Daftar peserta">
        {galat ? <div className="mb-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
        <FxDaftar
          rows={rows}
          kolom={[
            {
              t: 'Nama',
              isi: (b) => (
                <span className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pl text-[11px] font-extrabold text-pr">
                    {b.nama.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <b className="block leading-tight">{b.nama}</b>
                    {!b.aktif ? <small className="font-normal text-mu">nonaktif</small> : null}
                  </span>
                </span>
              ),
            },
            { t: 'Divisi', isi: (b) => b.divisi || '-' },
            {
              t: 'Rekap 30 hari',
              isi: (b) => (
                <span className="flex flex-wrap gap-1">
                  {REKAP.filter((s) => b.rekap_30_hari[s]).map((s) => (
                    <Badge key={s} s={`${s}: ${b.rekap_30_hari[s]}`} />
                  ))}
                  {REKAP.every((s) => !b.rekap_30_hari[s]) ? <span className="text-xs text-mu">belum ada absensi</span> : null}
                </span>
              ),
            },
            {
              t: 'Aksi',
              isi: (b) => (
                <Link
                  to={`/pembimbing/rekap?user_id=${b.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-garis bg-kartu px-2.5 py-1.5 text-xs font-bold text-pr no-underline transition hover:border-pr hover:bg-pl"
                >
                  Rekap
                  <Ikon nama="arrow" className="size-3.5" />
                </Link>
              ),
            },
          ]}
        />
      </Kartu>
    </>
  );
}
