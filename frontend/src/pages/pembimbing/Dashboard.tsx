import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { RingkasanPembimbing } from '../../lib/tipe';
import { Kartu, JudulHalaman, Pemberitahuan } from '../../komponen/ui';
import KartuProfil from '../../komponen/KartuProfil';
import { Ikon, type NamaIkon } from '../../komponen/Ikon';

const AKSES: { to: string; label: string; uraian: string; ikon: NamaIkon }[] = [
  { to: '/pembimbing/scan', label: 'Scan QR absensi', uraian: 'Pindai dan konfirmasi absen masuk/pulang peserta.', ikon: 'scan' },
  { to: '/pembimbing/peserta', label: 'Peserta bimbingan', uraian: 'Daftar peserta dan rekap singkat 30 hari terakhir.', ikon: 'users' },
  { to: '/pembimbing/jurnal', label: 'Review jurnal', uraian: 'Setujui atau minta revisi jurnal peserta.', ikon: 'clipboard' },
  { to: '/pembimbing/rekap', label: 'Rekap periode', uraian: 'Absensi dan jurnal dalam rentang tanggal.', ikon: 'chart' },
  { to: '/pembimbing/izin', label: 'Lihat izin/sakit', uraian: 'Tinjau pengajuan izin/sakit peserta beserta buktinya.', ikon: 'file' },
];

function Angka({ nilai, label, uraian, ikon, warna }: {
  nilai: number | null;
  label: string;
  uraian: string;
  ikon: NamaIkon;
  warna: string;
}) {
  return (
    <div className="rounded-kartu border border-garis bg-kartu p-4 shadow-kartu">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[1px] text-mu">{label}</p>
          <p className={`mt-2 text-[30px] font-extrabold leading-none tracking-tight ${warna}`}>
            {nilai ?? <span className="text-mu">…</span>}
          </p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pl text-pr">
          <Ikon nama={ikon} className="size-[17px]" />
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-mu">{uraian}</p>
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
      <JudulHalaman
        eyebrow="Pembimbing"
        judul="Beranda"
        sub="Pantau absensi dan jurnal peserta bimbingan Anda."
      />
      <KartuProfil />

      {galat ? (
        <Kartu t="Ringkasan hari ini">
          <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
        </Kartu>
      ) : (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Angka
            nilai={isi?.jumlah_peserta ?? null}
            label="Peserta bimbingan"
            uraian="Peserta aktif yang Anda dampingi."
            ikon="users"
            warna="text-teks"
          />
          <Angka
            nilai={isi?.hadir_hari_ini ?? null}
            label="Hadir hari ini"
            uraian="Peserta bimbingan yang sudah absen."
            ikon="checkCircle"
            warna="text-g"
          />
          <Angka
            nilai={isi?.perlu_review ?? null}
            label="Jurnal perlu review"
            uraian={isi?.perlu_review ? 'Menunggu keputusan Anda.' : 'Tidak ada jurnal yang menunggu.'}
            ikon="clipboard"
            warna={isi?.perlu_review ? 'text-y' : 'text-teks'}
          />
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Kartu t="Mulai dari sini">
          <div className="grid gap-3 sm:grid-cols-2">
            {AKSES.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="group flex items-start gap-3 rounded-xl border border-garis bg-[#fbfcfe] p-3.5 no-underline text-inherit transition hover:border-pr hover:bg-pl/40"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pl text-pr transition group-hover:bg-pr group-hover:text-white">
                  <Ikon nama={t.ikon} className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <b className="block text-[12.5px] font-extrabold leading-tight">{t.label}</b>
                  <small className="mt-1 block text-[11px] leading-snug text-mu">{t.uraian}</small>
                </span>
                <Ikon nama="chevron" className="ml-auto mt-1 size-3.5 shrink-0 text-[#a9b6c8]" />
              </Link>
            ))}
          </div>
        </Kartu>

        <Kartu t="Panduan singkat">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {[
              'Periksa jurnal yang masuk, lalu setujui atau minta revisi dengan catatan yang jelas.',
              'Pengajuan izin/sakit baru ditandai titik merah pada menu.',
              'Gunakan rekap periode untuk memantau kehadiran dan mengunduh laporan.',
            ].map((p, i) => (
              <li key={p} className="flex items-start gap-2.5 text-[11.5px] leading-snug text-[#4a5a72]">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-pl text-pr">
                  <Ikon nama={i === 0 ? 'clipboard' : i === 1 ? 'bell' : 'chart'} className="size-3" />
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl border border-garis bg-[#f8fafc] px-3.5 py-3">
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[1px] text-mu">
              <Ikon nama="shield" className="size-3.5 text-pr" />
              Catatan bimbingan
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-mu">
              Keputusan jurnal dan izin tercatat atas nama Anda. Pastikan catatan revisi cukup jelas untuk peserta.
            </p>
          </div>
        </Kartu>
      </div>
    </>
  );
}
