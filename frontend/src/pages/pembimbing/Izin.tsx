import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import { sinyalPeriksa } from '../../lib/notifikasi';
import type { PengajuanIzin } from '../../lib/tipe';
import { Kartu, JudulHalaman, Tombol, Pemberitahuan, Badge, Label } from '../../komponen/ui';
import { PenampilFoto } from '../../komponen/PenampilFoto';
import { useToast } from '../../komponen/Toast';
<<<<<<< Updated upstream
import { isoHariIni, tglIndoRentang, dalamRentang } from '../../komponen/umum';
import { Ikon } from '../../komponen/Ikon';
=======
import { isoHariIni, tglRentang } from '../../komponen/umum';
>>>>>>> Stashed changes

/** Lihat izin/sakit: pengajuan dari peserta (dengan bukti foto); pembimbing menyetujui
 * (hari itu terekam Izin/Sakit dan terkunci) atau menolak dengan alasan. */
export default function Izin() {
  const toast = useToast();
  const [daftar, ubahDaftar] = useState<PengajuanIzin[]>([]);
  const [muat, ubahMuat] = useState(true);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  // id pengajuan yang form tolaknya sedang terbuka (null = tertutup) — per kartu,
  // bukan flag tunggal yang menampilkan form di semua kartu Menunggu sekaligus.
  const [bukaTolak, ubahBukaTolak] = useState<number | null>(null);
  const [alasan, ubahAlasan] = useState('');
  const [sedang, ubahSedang] = useState(false);
  // Bukti foto yang sedang ditampilkan di modal dalam halaman (null = tertutup).
  const [bukti, ubahBukti] = useState<PengajuanIzin | null>(null);

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
      ubahBukaTolak(null);
      sinyalPeriksa(); // titik merah menu langsung diperiksa ulang
      muatUlang();
    } catch (err) {
      const e2 = err as ApiError;
      ubahGalat(teksKode(e2.kode ?? 'SERVER', e2.message));
    } finally {
      ubahSedang(false);
    }
  };

  const menunggu = daftar.filter((p) => p.status === 'Menunggu').length;
  const disetujui = daftar.filter((p) => p.status === 'Disetujui').length;
  const ditolak = daftar.filter((p) => p.status === 'Ditolak').length;

  return (
    <>
<<<<<<< Updated upstream
      <JudulHalaman
        eyebrow="Pembimbing"
        judul="Lihat izin / sakit"
        sub="Tinjau pengajuan peserta bimbingan beserta bukti foto."
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Menunggu', nilai: menunggu, warna: 'text-y', bg: 'bg-[#a1620716]' },
          { label: 'Disetujui', nilai: disetujui, warna: 'text-g', bg: 'bg-[#15803d16]' },
          { label: 'Ditolak', nilai: ditolak, warna: 'text-r', bg: 'bg-[#b91c1c12]' },
        ].map((s) => (
          <div key={s.label} className="rounded-kartu border border-garis bg-kartu p-3 shadow-kartu md:p-4">
            <p className="text-[9.5px] font-extrabold uppercase tracking-[.6px] text-mu md:text-[10px]">{s.label}</p>
            <p className={`mt-1 text-2xl font-extrabold leading-none ${s.warna}`}>{muat ? '…' : s.nilai}</p>
            <span className={`mt-2 block h-1 w-8 rounded-full ${s.bg}`} aria-hidden="true" />
          </div>
        ))}
      </div>

      <Kartu t="Pengajuan izin / sakit">
        <p className="max-w-[620px] text-xs leading-relaxed text-mu">
          Pengajuan izin/sakit dikirim oleh peserta beserta bukti foto. Bila Anda setujui, tanggal-tanggal
          dalam periode itu terekam sebagai Izin/Sakit dan otomatis terkunci dari absensi QR/wajah.
=======
      <Kartu t="Lihat izin / sakit">
        <p className="text-mu text-sm mb-2 max-w-[560px]">
          Pengajuan izin/sakit dikirim oleh peserta beserta bukti foto. Bila Anda setujui, setiap hari
          dalam rentang terekam sebagai Izin/Sakit dan otomatis terkunci dari absensi QR/wajah.
>>>>>>> Stashed changes
        </p>
        {muat ? <p className="mt-3 text-sm text-mu">Memuat pengajuan&hellip;</p> : null}
        {!muat && galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
      </Kartu>

      {!muat && !daftar.length && !galat ? (
        <Kartu>
          <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-pl text-pr">
              <Ikon nama="file" className="size-6" />
            </span>
            <b className="mt-3 text-sm">Belum ada pengajuan</b>
            <p className="mt-1 max-w-[320px] text-xs leading-relaxed text-mu">
              Pengajuan izin/sakit dari peserta bimbingan akan tampil di sini.
            </p>
          </div>
        </Kartu>
      ) : null}

      {daftar.map((p) => (
        <Kartu key={p.id}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pl text-[11px] font-extrabold text-pr">
              {(p.peserta?.nama ?? 'P').slice(0, 1).toUpperCase()}
            </span>
            <b className="text-[15px]">{p.peserta?.nama ?? `Peserta #${p.user_id}`}</b>
            <Badge s={p.jenis} />
            <Badge s={p.status} />
<<<<<<< Updated upstream
            {dalamRentang(isoHariIni(), p.tanggal, p.tanggal_selesai) ? <Badge s="Hari ini" /> : null}
            <span className="ml-auto text-[11px] text-mu">{tglIndoRentang(p.tanggal, p.tanggal_selesai)}</span>
=======
            <span className="text-mu text-sm">{tglRentang(p.tanggal, p.tanggal_akhir)}</span>
            {isoHariIni() >= p.tanggal && isoHariIni() <= (p.tanggal_akhir || p.tanggal) ? <Badge s="Hari ini" /> : null}
>>>>>>> Stashed changes
          </div>

          <p className="mt-3 max-w-[620px] whitespace-pre-line text-sm leading-relaxed">{p.keterangan}</p>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => ubahBukti(p)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-garis bg-[#fbfcfe] px-2.5 py-1.5 text-xs font-bold text-pr no-underline transition hover:border-pr hover:bg-pl"
            >
              <Ikon nama="image" className="size-3.5" />
              Buka bukti foto
            </button>
          </div>

          {p.status === 'Ditolak' && p.catatan_putusan ? (
            <div className="mt-3">
              <Pemberitahuan jenis="er" judul="Alasan penolakan" uraian={p.catatan_putusan} />
            </div>
          ) : null}

          {p.status === 'Menunggu' ? (
            <div className="mt-3 border-t border-garis pt-3">
              <div className="flex flex-wrap gap-2">
                <Tombol disabled={sedang} onClick={() => putuskan(p.id, 'Disetujui')}>
                  <Ikon nama="check" className="size-4" />
                  Setujui
                </Tombol>
                <Tombol varian="gh" disabled={sedang} onClick={() => ubahBukaTolak(p.id)}>
                  Tolak&hellip;
                </Tombol>
              </div>
              {bukaTolak === p.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    putuskan(p.id, 'Ditolak');
                  }}
                  className="mt-3 max-w-[560px]"
                >
                  <Label htmlFor={`alasan_${p.id}`} className="mt-0">Alasan penolakan (wajib)</Label>
                  <textarea
                    id={`alasan_${p.id}`}
                    required
                    minLength={3}
                    maxLength={500}
                    rows={2}
                    value={alasan}
                    onChange={(e) => ubahAlasan(e.target.value)}
                    className="mt-1 block w-full rounded-[11px] border border-garis bg-kartu px-3 py-2.5 text-sm outline-none transition focus:border-pr focus:ring-4 focus:ring-pr/10"
                    placeholder="Misal: Bukti foto tidak jelas, mohon unggah ulang."
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Tombol varian="dg" type="submit" disabled={sedang || alasan.trim().length < 3}>
                      Tolak pengajuan
                    </Tombol>
                    <Tombol varian="gh" disabled={sedang} onClick={() => ubahBukaTolak(null)}>
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

      <PenampilFoto
        buka={bukti !== null}
        judul={bukti ? `Bukti ${bukti.jenis} — ${bukti.peserta?.nama ?? `Peserta #${bukti.user_id}`} (${tglIndoRentang(bukti.tanggal, bukti.tanggal_selesai)})` : 'Bukti pengajuan'}
        sumber={bukti ? `/pengajuan/bukti/${bukti.bukti}` : ''}
        namaBerkas={bukti ? `bukti-${bukti.jenis.toLowerCase()}-${bukti.tanggal}` : 'bukti-pengajuan'}
        tutup={() => ubahBukti(null)}
      />
    </>
  );
}
