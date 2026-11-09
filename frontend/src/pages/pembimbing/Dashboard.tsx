import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { RingkasanPembimbing } from '../../lib/tipe';
import { Kartu, Pemberitahuan } from '../../komponen/ui';

function Angka({ nilai, label, warna }: { nilai: number | null; label: string; warna: string }) {
  return (
    <div className={`rounded-xl p-4 border border-garis bg-kartu flex-1 min-w-[140px] ${warna}`}>
      <p className="text-3xl font-extrabold">{nilai ?? '…'}</p>
      <p className="text-sm text-mu font-semibold mt-1">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const [isi, ubahIsi] = useState<RingkasanPembimbing | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);

  useEffect(() => {
    api<RingkasanPembimbing>('/pembimbing/ringkasan')
      .then(ubahIsi)
      .catch((e) => ubahGalat(teksKode((e as ApiError).kode ?? 'SERVER', (e as ApiError).message)));
  }, []);

  return (
    <>
      <Kartu t="Ringkasan hari ini">
        {galat ? (
          <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
        ) : (
          <div className="flex flex-wrap gap-3">
            <Angka nilai={isi?.jumlah_peserta ?? null} label="Peserta bimbingan" warna="text-teks" />
            <Angka nilai={isi?.hadir_hari_ini ?? null} label="Hadir hari ini" warna="text-g" />
            <Angka nilai={isi?.perlu_review ?? null} label="Jurnal perlu review" warna={isi?.perlu_review ? 'text-y' : 'text-teks'} />
          </div>
        )}
      </Kartu>

      <Kartu t="Mulai dari sini">
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            { to: '/pembimbing/scan', label: 'Scan QR absensi', uraian: 'Pindai dan konfirmasi absen masuk/pulang peserta.' },
            { to: '/pembimbing/peserta', label: 'Peserta bimbingan', uraian: 'Daftar peserta dan rekap singkat 30 hari terakhir.' },
            { to: '/pembimbing/jurnal', label: 'Review jurnal', uraian: 'Setujui atau minta revisi jurnal peserta.' },
            { to: '/pembimbing/rekap', label: 'Rekap periode', uraian: 'Absensi dan jurnal dalam rentang tanggal.' },
            { to: '/pembimbing/izin', label: 'Lihat izin/sakit', uraian: 'Setujui atau tolak pengajuan izin/sakit peserta beserta buktinya.' },
          ].map((t) => (
            <li key={t.to}>
              <Link to={t.to} className="block h-full rounded-xl border-2 border-garis p-4 no-underline text-inherit hover:border-pr bg-kartu">
                <b className="block">{t.label}</b>
                <small className="text-mu">{t.uraian}</small>
              </Link>
            </li>
          ))}
        </ul>
      </Kartu>
    </>
  );
}
