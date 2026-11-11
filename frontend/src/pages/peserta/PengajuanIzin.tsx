import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { PengajuanIzin } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Label, Badge } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';
import { isoHariIni, tglIndo } from '../../komponen/umum';

const BUKTI_MAKS = 5 * 1024 * 1024;
const BATAS_HARI = 7; // JURNAL_MAKS_HARI_BELAKANG di backend
const MAKS_MAJU = 1; // PENGAJUAN_MAKS_HARI_MAJU di backend

/** Tanggal ISO paling awal yang boleh diajukan (BATAS_HARI ke belakang). */
const isoBatas = () =>
  new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Jakarta' })
    .format(new Date(Date.now() - BATAS_HARI * 86400000))
    .slice(0, 10);

/** Tanggal ISO terjauh yang boleh diajukan (MAKS_MAJU ke depan). */
const isoMaju = () =>
  new Intl.DateTimeFormat('sv', { timeZone: 'Asia/Jakarta' })
    .format(new Date(Date.now() + MAKS_MAJU * 86400000))
    .slice(0, 10);

/** Halaman pengajuan izin/sakit peserta: kirim beserta bukti foto, lalu pantau statusnya.
 * Bila pembimbing menyetujui, hari itu terekam Izin/Sakit dan terkunci dari absensi QR/wajah. */
export default function PengajuanIzin() {
  const toast = useToast();
  const [jenis, ubahJenis] = useState<'Izin' | 'Sakit'>('Izin');
  const [tanggal, ubahTanggal] = useState(isoHariIni());
  const [keterangan, ubahKet] = useState('');
  const [berkas, ubahBerkas] = useState<File | null>(null);
  const [daftar, ubahDaftar] = useState<PengajuanIzin[] | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [sedang, ubahSedang] = useState(false);
  const unggahRef = useRef<HTMLInputElement>(null);

  /** Bukti hanya tersedia lewat API (token disertakan); buka di tab baru lewat blob URL. */
  const bukaBukti = async (p: PengajuanIzin) => {
    try {
      const r = await api<Response>(`/pengajuan/bukti/${p.bukti}`, { raw: true });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const tab = window.open(url, '_blank', 'noopener');
      if (!tab) {
        // Blokir pop-up: tab tidak terbuka, jangan biarkan tombol terkesan mati
        ubahGalat(['Pop-up diblokir', 'Izinkan pop-up untuk situs ini lalu tekan "Lihat bukti" sekali lagi.']);
      }
      setTimeout(() => { URL.revokeObjectURL(url); }, 300000);
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message) as [string, string]);
    }
  };

  const muatUlang = useCallback(() => {
    api<{ data: PengajuanIzin[] }>('/pengajuan/izin')
      .then((r) => ubahDaftar(r.data))
      .catch(() => ubahDaftar([]));
  }, []);

  useEffect(() => {
    muatUlang();
  }, [muatUlang]);

  const pilihBerkas = (f: File | null) => {
    ubahGalat(null);
    if (!f) {
      ubahBerkas(null);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      ubahGalat(teksKode('UPLOAD'));
      ubahBerkas(null);
      return;
    }
    if (f.size > BUKTI_MAKS) {
      ubahGalat(['Bukti terlalu besar', 'Ukuran bukti maksimal 5 MB. Kompres foto lalu pilih ulang.']);
      ubahBerkas(null);
      return;
    }
    ubahBerkas(f);
  };

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (keterangan.trim().length < 3 || !berkas) return;
    ubahSedang(true);
    ubahGalat(null);
    try {
      const bentuk = new FormData();
      bentuk.append('jenis', jenis);
      bentuk.append('tanggal', tanggal);
      bentuk.append('keterangan', keterangan.trim());
      bentuk.append('bukti', berkas);
      const r = await api<{ pesan: string }>('/pengajuan/izin', { method: 'POST', bentuk });
      toast(r.pesan);
      ubahKet('');
      ubahBerkas(null);
      if (unggahRef.current) unggahRef.current.value = '';
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
      <Kartu t="Kirim pengajuan izin / sakit">
        <p className="text-mu text-sm mb-1 max-w-[560px]">
          Tidak bisa absen QR atau wajah hari itu? Ajukan Izin/Sakit dengan bukti foto. Setelah
          pembimbing menyetujui, tanggal tersebut terekam dan terkunci — Anda tidak perlu absen lagi.
        </p>
        <form onSubmit={kirim} className="max-w-[560px]">
          <fieldset className="mt-2">
            <legend className="text-[13px] font-semibold">Jenis pengajuan</legend>
            <div className="flex gap-4 mt-1">
              {(['Izin', 'Sakit'] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm font-semibold">
                  <input type="radio" name="pj_jenis" checked={jenis === s} onChange={() => ubahJenis(s)} />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
          <p>
            <Label htmlFor="pj_tgl">
              Tanggal (boleh {MAKS_MAJU} hari ke depan, maksimal {BATAS_HARI} hari ke belakang)
            </Label>
            <input
              id="pj_tgl"
              type="date"
              required
              max={isoMaju()}
              min={isoBatas()}
              value={tanggal}
              onChange={(e) => ubahTanggal(e.target.value)}
              className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
            />
          </p>
          <p>
            <Label htmlFor="pj_ket">
              Keterangan <span className="text-r">wajib</span> (3–1000 karakter)
            </Label>
            <textarea
              id="pj_ket"
              required
              minLength={3}
              maxLength={1000}
              rows={3}
              value={keterangan}
              onChange={(e) => ubahKet(e.target.value)}
              className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
              placeholder="Misal: Demam sejak subuh, surat dokter menyusul."
            />
          </p>
          <p>
            <Label htmlFor="pj_bukti">
              Bukti foto <span className="text-r">wajib</span> (JPG/PNG/WebP, maksimal 5 MB)
            </Label>
            <input
              id="pj_bukti"
              ref={unggahRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => pilihBerkas(e.target.files?.[0] ?? null)}
              className="block w-full mt-1 px-[11px] py-[7px] border border-garis rounded-lg bg-bg text-sm"
            />
            {berkas ? (
              <small className="block mt-1 text-mu">{berkas.name} ({Math.round(berkas.size / 1024)} KB)</small>
            ) : null}
          </p>
          {galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}
          <p className="mt-4">
            <Tombol type="submit" disabled={sedang || keterangan.trim().length < 3 || !berkas}>
              {sedang ? 'Mengirim…' : `Kirim pengajuan ${jenis.toLowerCase()}`}
            </Tombol>
          </p>
        </form>
      </Kartu>

      <Kartu t="Riwayat pengajuan saya">
        {daftar === null ? (
          <p className="text-mu text-sm">Memuat pengajuan&hellip;</p>
        ) : daftar.length === 0 ? (
          <p className="text-mu text-sm mb-0">Belum ada pengajuan. Kirim lewat form di atas bila perlu.</p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-3">
            {daftar.map((p) => (
              <li key={p.id} className="border border-garis rounded-xl p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-sm">{tglIndo(p.tanggal)}</b>
                  <Badge s={p.jenis} />
                  <Badge s={p.status} />
                </div>
                <p className="text-sm mt-1.5 mb-1 whitespace-pre-line">{p.keterangan}</p>
                <button
                  type="button"
                  onClick={() => { void bukaBukti(p); }}
                  className="text-pr text-sm font-semibold no-underline hover:underline"
                >
                  Lihat bukti foto
                </button>
                {p.status === 'Ditolak' && p.catatan_putusan ? (
                  <div className="mt-2">
                    <Pemberitahuan jenis="er" judul="Ditolak oleh pembimbing" uraian={p.catatan_putusan} />
                  </div>
                ) : null}
                {p.status === 'Menunggu' ? (
                  <p className="text-mu text-xs mt-2 mb-0">Menunggu putusan pembimbing.</p>
                ) : null}
                {p.status === 'Disetujui' ? (
                  <p className="text-g text-xs font-semibold mt-2 mb-0">
                    Disetujui — tanggal tersebut terekam {p.jenis.toLowerCase()} dan tidak perlu absen.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Kartu>
    </>
  );
}
