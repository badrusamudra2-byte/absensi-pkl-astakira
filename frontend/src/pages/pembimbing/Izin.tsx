import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import { sinyalPeriksa } from '../../lib/notifikasi';
import type { PengajuanIzin } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Badge, Label } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';
import { isoHariIni } from '../../komponen/umum';

/** Lihat izin/sakit: pengajuan dari peserta (dengan bukti foto); pembimbing menyetujui
 * (hari itu terekam Izin/Sakit dan terkunci) atau menolak dengan alasan. */
export default function Izin() {
  const toast = useToast();
  const [daftar, ubahDaftar] = useState<PengajuanIzin[]>([]);
  const [muat, ubahMuat] = useState(true);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [bukaTolak, ubahBukaTolak] = useState(false);
  const [alasan, ubahAlasan] = useState('');
  const [sedang, ubahSedang] = useState(false);

  const muatUlang = useCallback(() => {
    ubahMuat(true);
    api<{ data: PengajuanIzin[] }>('/pengajuan/izin')
      .then((r) => {
        ubahDaftar(r.data);
        ubahGalat(null);
      })
      .catch((err: ApiError) => {
        ubahDaftar([]);
        ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
      })
      .finally(() => ubahMuat(false));
  }, []);

  useEffect(() => {
    muatUlang();
  }, [muatUlang]);

  const putuskan = async (id: number, putusan: 'Disetujui' | 'Ditolak') => {
    ubahSedang(true);
    ubahGalat(null);
    try {
      const r = await api<{ pesan: string }>(`/pengajuan/izin/${id}/putuskan`, {
        method: 'PUT',
        json: { putusan, alasan: putusan === 'Ditolak' ? alasan.trim() : undefined },
      });
      toast(r.pesan);
      ubahAlasan('');
      ubahBukaTolak(false);
      sinyalPeriksa(); // titik merah menu langsung diperiksa ulang
      muatUlang();
    } catch (err) {
      const e2 = err as ApiError;
      ubahGalat(teksKode(e2.kode ?? 'SERVER', e2.message));
    } finally {
      ubahSedang(false);
    }
  };

  return (
    <>
      <Kartu t="Lihat izin / sakit">
        <p className="text-mu text-sm mb-2 max-w-[560px]">
          Pengajuan izin/sakit dikirim oleh peserta beserta bukti foto. Bila Anda setujui, hari itu
          terekam sebagai Izin/Sakit dan otomatis terkunci dari absensi QR/wajah.
        </p>
        {muat ? <p className="text-mu text-sm">Memuat pengajuan&hellip;</p> : null}
        {!muat && galat ? <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /> : null}
      </Kartu>

      {!muat && !daftar.length && !galat ? (
        <Kartu>
          <p className="text-mu text-sm m-0">Belum ada pengajuan izin/sakit pada periode ini.</p>
        </Kartu>
      ) : null}

      {daftar.map((p) => (
        <Kartu key={p.id} className="!p-[14px] md:!p-4">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-[15px]">{p.peserta?.nama ?? `Peserta #${p.user_id}`}</b>
            <Badge s={p.jenis} />
            <Badge s={p.status} />
            <span className="text-mu text-sm">{p.tanggal}</span>
            {p.tanggal === isoHariIni() ? <Badge s="Hari ini" /> : null}
          </div>
          <p className="text-sm mt-2 max-w-[620px] whitespace-pre-line">{p.keterangan}</p>
          <div className="mt-2">
            <a
              href={`/uploads/pengajuan/${p.bukti}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-pr text-sm font-semibold no-underline hover:underline"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.5-3.5L7 22" />
              </svg>
              Buka bukti foto
            </a>
          </div>
          {p.status === 'Ditolak' && p.catatan_putusan ? (
            <div className="mt-2">
              <Pemberitahuan jenis="er" judul="Alasan penolakan" uraian={p.catatan_putusan} />
            </div>
          ) : null}

          {p.status === 'Menunggu' ? (
            <div className="mt-3 border-t border-garis pt-3">
              <div className="flex flex-wrap gap-2">
                <Tombol disabled={sedang} onClick={() => putuskan(p.id, 'Disetujui')}>
                  Setujui
                </Tombol>
                <Tombol varian="gh" disabled={sedang} onClick={() => ubahBukaTolak(true)}>
                  Tolak&hellip;
                </Tombol>
              </div>
              {bukaTolak ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    putuskan(p.id, 'Ditolak');
                  }}
                  className="max-w-[560px] mt-1"
                >
                  <Label htmlFor={`alasan_${p.id}`}>Alasan penolakan (wajib)</Label>
                  <textarea
                    id={`alasan_${p.id}`}
                    required
                    minLength={3}
                    maxLength={500}
                    rows={2}
                    value={alasan}
                    onChange={(e) => ubahAlasan(e.target.value)}
                    className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
                    placeholder="Misal: Bukti foto tidak jelas, mohon unggah ulang."
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Tombol varian="dg" type="submit" disabled={sedang || alasan.trim().length < 3}>
                      Tolak pengajuan
                    </Tombol>
                    <Tombol varian="gh" disabled={sedang} onClick={() => ubahBukaTolak(false)}>
                      Batal
                    </Tombol>
                  </div>
                </form>
              ) : null}
              {!muat && galat ? (
                <div className="mt-2 max-w-[560px]">
                  <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
                </div>
              ) : null}
            </div>
          ) : null}
        </Kartu>
      ))}
    </>
  );
}
