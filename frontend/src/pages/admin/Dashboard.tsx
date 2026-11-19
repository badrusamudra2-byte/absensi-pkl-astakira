import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { RingkasanAdmin } from '../../lib/tipe';
import { Kartu, JudulHalaman, Pemberitahuan } from '../../komponen/ui';
import { tglPendek } from '../../komponen/umum';
import { Ikon, type NamaIkon } from '../../komponen/Ikon';

function Angka({ nilai, label, uraian, ikon, warna, latar }: {
  nilai: number | null;
  label: string;
  uraian: string;
  ikon: NamaIkon;
  warna: string;
  latar: string;
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
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${latar} ${warna}`}>
          <Ikon nama={ikon} className="size-[17px]" />
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-mu">{uraian}</p>
    </div>
  );
}

/** Grafik batang sederhana (tanpa pustaka) untuk 7 hari terakhir. */
function Grafik({ data }: { data: RingkasanAdmin['grafik'] }) {
  const hari = [...new Set(data.map((g) => g.tanggal))].sort();
  if (!hari.length) {
    return (
      <div className="rounded-[12px] border border-dashed border-garis px-4 py-8 text-center">
        <p className="text-sm text-mu">Belum ada absensi 7 hari terakhir.</p>
      </div>
    );
  }
  const maks = Math.max(...data.map((g) => g.n), 1);
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex h-52 min-w-[420px] items-end gap-4 border-b border-garis pb-0" role="img" aria-label="Grafik kehadiran 7 hari terakhir">
          {hari.map((t) => {
            const hadir = data.find((g) => g.tanggal === t && g.status === 'Hadir')?.n ?? 0;
            const telat = data.find((g) => g.tanggal === t && g.status === 'Terlambat')?.n ?? 0;
            return (
              <div key={t} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <div className="flex w-full flex-1 items-end justify-center gap-1.5">
                  <div
                    className="w-7 rounded-t-md bg-g/85 transition-all"
                    style={{ height: `${Math.max((hadir / maks) * 100, hadir ? 4 : 0)}%` }}
                    title={`Hadir: ${hadir}`}
                  />
                  <div
                    className="w-7 rounded-t-md bg-y/85 transition-all"
                    style={{ height: `${Math.max((telat / maks) * 100, telat ? 4 : 0)}%` }}
                    title={`Terlambat: ${telat}`}
                  />
                </div>
                <small className="whitespace-nowrap pb-2 text-[10px] font-semibold text-mu">{tglPendek(t)}</small>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-semibold text-mu">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-g" /> Hadir</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-y" /> Terlambat</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [isi, ubahIsi] = useState<RingkasanAdmin | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);

  useEffect(() => {
    api<RingkasanAdmin>('/admin/ringkasan')
      .then(ubahIsi)
      .catch((e) => ubahGalat(teksKode((e as ApiError).kode ?? 'SERVER', (e as ApiError).message)));
  }, []);

  return (
    <>
      <JudulHalaman
        eyebrow="Admin"
        judul="Beranda"
        sub="Ringkasan peserta, pembimbing, dan kehadiran hari ini."
      />

      {galat ? (
        <Kartu t="Ringkasan hari ini">
          <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
        </Kartu>
      ) : (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Angka
            nilai={isi?.peserta_aktif ?? null}
            label="Peserta aktif"
            uraian="Peserta yang dapat melakukan absensi."
            ikon="users"
            warna="text-teks"
            latar="bg-pl"
          />
          <Angka
            nilai={isi?.pembimbing_aktif ?? null}
            label="Pembimbing aktif"
            uraian="Pembimbing yang mendampingi peserta."
            ikon="briefcase"
            warna="text-pr"
            latar="bg-pl"
          />
          <Angka
            nilai={isi?.hadir_hari_ini ?? null}
            label="Hadir hari ini"
            uraian="Absensi masuk dengan status hadir."
            ikon="checkCircle"
            warna="text-g"
            latar="bg-[#15803d18]"
          />
          <Angka
            nilai={isi?.terlambat_hari_ini ?? null}
            label="Terlambat hari ini"
            uraian="Absensi masuk melewati toleransi."
            ikon="clock"
            warna="text-y"
            latar="bg-[#a1620716]"
          />
        </div>
      )}

      <Kartu t="Kehadiran 7 hari terakhir">
        {isi ? <Grafik data={isi.grafik} /> : <p className="text-sm text-mu">Memuat grafik&hellip;</p>}
      </Kartu>
    </>
  );
}
