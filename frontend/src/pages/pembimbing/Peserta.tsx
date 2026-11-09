import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { BarisPesertaPembimbing, StatusAbsensi } from '../../lib/tipe';
import { Kartu, Pemberitahuan, Badge } from '../../komponen/ui';
import { FxDaftar } from '../../komponen/umum';

const REKAP: StatusAbsensi[] = ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Tidak hadir'];

export default function Peserta() {
  const [rows, ubahRows] = useState<BarisPesertaPembimbing[] | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);

  useEffect(() => {
    api<{ data: BarisPesertaPembimbing[] }>('/pembimbing/peserta')
      .then((r) => ubahRows(r.data))
      .catch((e) => ubahGalat(teksKode((e as ApiError).kode ?? 'SERVER', (e as ApiError).message)));
  }, []);

  return (
    <Kartu t="Peserta bimbingan">
      {galat ? <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /> : null}
      <FxDaftar
        rows={rows}
        kolom={[
          {
            t: 'Nama',
            isi: (b) => (
              <b>
                {b.nama}
                {!b.aktif ? <small className="block text-mu font-normal">nonaktif</small> : null}
              </b>
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
                {REKAP.every((s) => !b.rekap_30_hari[s]) ? <span className="text-mu text-xs">belum ada absensi</span> : null}
              </span>
            ),
          },
          {
            t: 'Aksi',
            isi: (b) => <Link to={`/pembimbing/rekap?user_id=${b.id}`} className="text-pr underline text-sm">Rekap</Link>,
          },
        ]}
      />
    </Kartu>
  );
}
