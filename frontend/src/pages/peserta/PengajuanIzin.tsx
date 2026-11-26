import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { PengajuanIzin } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Label, Badge, JudulHalaman } from '../../komponen/ui';
import { Ikon } from '../../komponen/Ikon';
import { PenampilFoto } from '../../komponen/PenampilFoto';
import { useToast } from '../../komponen/Toast';
<<<<<<< Updated upstream
import { isoHariIni, tglIndoRentang } from '../../komponen/umum';
=======
import { isoHariIni, tglRentang } from '../../komponen/umum';
>>>>>>> Stashed changes

const BUKTI_MAKS = 5 * 1024 * 1024;
const BATAS_HARI = 7; // JURNAL_MAKS_HARI_BELAKANG di backend
const MAKS_MAJU = 7; // PENGAJUAN_MAKS_HARI_MAJU di backend
const MAKS_RENTANG = 7; // PENGAJUAN_MAKS_HARI di backend (inklusif)

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

/** Geser tanggal ISO sebanyak n hari. */
const geserHari = (s: string, n: number) =>
  new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Selisih hari antara dua tanggal ISO (b - a). */
const selisihHari = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Halaman pengajuan izin/sakit peserta: kirim beserta bukti foto, lalu pantau statusnya.
 * Bila pembimbing menyetujui, hari itu terekam Izin/Sakit dan terkunci dari absensi QR/wajah. */
export default function PengajuanIzin() {
  const toast = useToast();
  const [jenis, ubahJenis] = useState<'Izin' | 'Sakit'>('Izin');
  const [tanggal, ubahTanggal] = useState(isoHariIni());
<<<<<<< Updated upstream
  const [tanggalSelesai, ubahTanggalSelesai] = useState(isoHariIni());
=======
  const [tanggalAkhir, ubahTanggalAkhir] = useState(isoHariIni());
>>>>>>> Stashed changes
  const [keterangan, ubahKet] = useState('');
  const [berkas, ubahBerkas] = useState<File | null>(null);
  const [daftar, ubahDaftar] = useState<PengajuanIzin[] | null>(null);
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [sedang, ubahSedang] = useState(false);
  // Bukti foto yang sedang ditampilkan di modal dalam halaman (null = tertutup).
  const [bukti, ubahBukti] = useState<PengajuanIzin | null>(null);
  const unggahRef = useRef<HTMLInputElement>(null);

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

  const jumlahHari = selisihHari(tanggal, tanggalAkhir) + 1;
  const maksAkhir = [geserHari(tanggal, MAKS_RENTANG - 1), isoMaju()].sort()[0];

  /** Saat tanggal mulai berubah, jaga agar tanggal selesai tetap sesudahnya dan
   * tidak melewati batas 7 hari. */
  const gantiMulai = (v: string) => {
    ubahGalat(null);
    ubahTanggal(v);
    const batasAkhir = [geserHari(v, MAKS_RENTANG - 1), isoMaju()].sort()[0];
    if (tanggalAkhir < v) ubahTanggalAkhir(v);
    else if (tanggalAkhir > batasAkhir) ubahTanggalAkhir(batasAkhir);
  };

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
<<<<<<< Updated upstream
    if (keterangan.trim().length < 3 || !berkas || !tanggal || !tanggalSelesai || tanggalSelesai < tanggal) return;
=======
    if (keterangan.trim().length < 3 || !berkas) return;
    if (jumlahHari < 1) {
      ubahGalat(['Tanggal tidak sah', 'Tanggal selesai tidak boleh sebelum tanggal mulai.']);
      return;
    }
    if (jumlahHari > MAKS_RENTANG) {
      ubahGalat(['Terlalu panjang', `Izin/sakit maksimal ${MAKS_RENTANG} hari berturut-turut.`]);
      return;
    }
>>>>>>> Stashed changes
    ubahSedang(true);
    ubahGalat(null);
    try {
      const bentuk = new FormData();
      bentuk.append('jenis', jenis);
      bentuk.append('tanggal', tanggal);
<<<<<<< Updated upstream
      bentuk.append('tanggal_selesai', tanggalSelesai);
=======
      bentuk.append('tanggal_akhir', tanggalAkhir);
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
      <JudulHalaman
        eyebrow="Peserta PKL"
        judul="Pengajuan Izin / Sakit"
        sub="Ajukan ketidakhadiran beserta bukti foto, lalu pantau statusnya."
      />

      <div className="grid lg:grid-cols-[1.45fr_1fr] gap-4 items-start">
        <Kartu className="!p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-garis">
            <span className="size-8 rounded-lg bg-pl text-pr grid place-items-center">
              <Ikon nama="file" className="size-4" />
            </span>
            <b className="text-[12.5px] font-extrabold">Formulir pengajuan</b>
          </div>
          <form onSubmit={kirim} className="p-4 md:p-5">
            <p className="text-[11.5px] text-mu leading-relaxed mb-4">
              Tidak bisa absen QR atau wajah hari itu? Ajukan Izin/Sakit dengan bukti foto. Setelah
              pembimbing menyetujui, tanggal-tanggal tersebut terekam dan terkunci dari absensi.
            </p>

            <fieldset className="m-0 p-0 border-0">
              <legend className="text-[10px] font-extrabold uppercase tracking-[1px] text-mu mb-1.5">Jenis pengajuan</legend>
              <div className="grid grid-cols-2 gap-2.5">
                {(['Izin', 'Sakit'] as const).map((s) => (
                  <label
                    key={s}
                    className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 cursor-pointer transition ${
                      jenis === s ? 'border-pr bg-pl' : 'border-garis bg-[#fbfcfe] hover:border-[#b8c9e8]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pj_jenis"
                      className="size-4 accent-[#1d4ed8]"
                      checked={jenis === s}
                      onChange={() => ubahJenis(s)}
                    />
                    <span className={`size-7 rounded-lg grid place-items-center ${jenis === s ? 'bg-pr text-white' : 'bg-[#eef2f8] text-[#5b6c85]'}`}>
                      <Ikon nama={s === 'Sakit' ? 'activity' : 'file'} className="size-3.5" />
                    </span>
                    <span className="text-[11.5px] font-bold">{s}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pj_tgl" className="!mt-0">
                  Dari tanggal <span className="text-r">wajib</span>
                </Label>
                <input
                  id="pj_tgl"
                  type="date"
                  required
                  max={isoMaju()}
                  min={isoBatas()}
                  value={tanggal}
                  onChange={(e) => {
                    const v = e.target.value;
                    const mulaiLama = tanggal;
                    ubahTanggal(v);
                    // Ikuti tanggal mulai bila akhir masih satu hari dengan mulai lama
                    // (nilai bawaan), atau bila akhir jadi mendahului mulai.
                    // Rentang yang memang dipilih lebih panjang tetap dipertahankan.
                    if (tanggalSelesai < v || tanggalSelesai === mulaiLama) ubahTanggalSelesai(v);
                  }}
                  className="block w-full h-[38px] px-3 border border-garis rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
                />
              </div>
              <div>
                <Label htmlFor="pj_tgl_selesai" className="!mt-0">
                  Sampai tanggal <span className="text-r">wajib</span>
                </Label>
                <input
                  id="pj_tgl_selesai"
                  type="date"
                  required
                  max={isoMaju()}
                  min={tanggal || isoBatas()}
                  value={tanggalSelesai}
                  onChange={(e) => ubahTanggalSelesai(e.target.value)}
                  className="block w-full h-[38px] px-3 border border-garis rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
                />
              </div>
            </div>
            <small className="block text-mu text-[10px] mt-1">
              Isi tanggal sama bila hanya satu hari. Boleh {MAKS_MAJU} hari ke depan, maksimal {BATAS_HARI} hari ke belakang.
            </small>

            <div className="mt-3">
              <Label htmlFor="pj_ket" className="!mt-0">
                Keterangan <span className="text-r">wajib</span>
              </Label>
              <textarea
                id="pj_ket"
                required
                minLength={3}
                maxLength={1000}
                rows={3}
                value={keterangan}
                onChange={(e) => ubahKet(e.target.value)}
                className="block w-full px-3 py-2 border border-garis rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
                placeholder="Misal: Demam sejak subuh, surat dokter menyusul."
              />
              <div className="flex justify-between gap-2 text-[10px] text-mu mt-1">
                <span>Minimal 3 karakter.</span>
                <span>{keterangan.length}/1000</span>
              </div>
            </div>

            <div className="mt-3">
              <Label htmlFor="pj_bukti" className="!mt-0">
                Bukti foto <span className="text-r">wajib</span>
              </Label>
              <input
                id="pj_bukti"
                ref={unggahRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(e) => pilihBerkas(e.target.files?.[0] ?? null)}
                className="block w-full px-3 py-[7px] border border-garis rounded-lg bg-bg text-[11.5px] file:mr-2 file:px-3 file:py-1 file:rounded-md file:border-0 file:bg-pl file:text-pr file:text-[10.5px] file:font-bold file:cursor-pointer"
              />
              {berkas ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] px-2.5 py-1.5">
                  <Ikon nama="image" className="size-3.5 text-[#15803d]" />
                  <span className="text-[10.5px] text-[#166534] truncate">{berkas.name}</span>
                  <span className="text-[10px] text-[#4d7c5f] ml-auto whitespace-nowrap">{Math.round(berkas.size / 1024)} KB</span>
                </div>
              ) : (
                <small className="block text-mu text-[10px] mt-1">JPG/PNG/WebP, maksimal 5 MB.</small>
              )}
            </div>

            {galat ? <div className="mt-3"><Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} /></div> : null}

            <div className="mt-4 pt-4 border-t border-garis flex flex-wrap items-center gap-2">
              <Tombol type="submit" disabled={sedang || keterangan.trim().length < 3 || !berkas || !tanggal || !tanggalSelesai || tanggalSelesai < tanggal}>
                {sedang ? 'Mengirim…' : `Kirim pengajuan ${jenis.toLowerCase()}`}
              </Tombol>
              <span className="text-[10px] text-mu">Persetujuan pembimbing diperlukan.</span>
            </div>
          </form>
        </Kartu>

        <div>
          <Kartu t="Ketentuan pengajuan">
            <ul className="list-none p-0 m-0 flex flex-col gap-3">
              {[
                { i: 'calendar' as const, t: 'Batas waktu', u: `Maksimal ${MAKS_MAJU} hari ke depan dan ${BATAS_HARI} hari ke belakang.` },
                { i: 'image' as const, t: 'Bukti foto wajib', u: 'Format JPG, PNG, atau WebP maksimal 5 MB.' },
                { i: 'users' as const, t: 'Putusan pembimbing', u: 'Disetujui atau ditolak disertai alasan yang dapat Anda baca.' },
                { i: 'lock' as const, t: 'Mengunci absensi', u: 'Tanggal yang disetujui tidak memerlukan verifikasi wajah atau QR.' },
              ].map((x) => (
                <li key={x.t} className="flex items-start gap-2.5">
                  <span className="size-7 rounded-lg bg-pl text-pr grid place-items-center shrink-0">
                    <Ikon nama={x.i} className="size-3.5" />
                  </span>
                  <div>
                    <b className="block text-[11px] font-extrabold">{x.t}</b>
                    <p className="text-[10.5px] text-mu mt-0.5 leading-snug">{x.u}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Kartu>
        </div>
      </div>
=======
      <Kartu t="Kirim pengajuan izin / sakit">
        <p className="text-mu text-sm mb-1 max-w-[560px]">
          Tidak bisa absen QR atau wajah pada suatu hari? Ajukan Izin/Sakit dengan bukti foto. Setelah
          pembimbing menyetujui, setiap tanggal dalam rentang terekam dan terkunci — Anda tidak perlu
          absen lagi pada hari-hari itu.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <p>
              <Label htmlFor="pj_tgl">Tanggal mulai</Label>
              <input
                id="pj_tgl"
                type="date"
                required
                max={isoMaju()}
                min={isoBatas()}
                value={tanggal}
                onChange={(e) => gantiMulai(e.target.value)}
                className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
              />
            </p>
            <p>
              <Label htmlFor="pj_tgl_akhir">Tanggal selesai</Label>
              <input
                id="pj_tgl_akhir"
                type="date"
                required
                min={tanggal}
                max={maksAkhir}
                value={tanggalAkhir}
                onChange={(e) => { ubahGalat(null); ubahTanggalAkhir(e.target.value); }}
                className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
              />
            </p>
          </div>
          <small className="block -mt-1 mb-2 text-mu">
            Maksimal {MAKS_RENTANG} hari berturut-turut; pengajuan boleh sampai {MAKS_MAJU} hari ke depan
            dan maksimal {BATAS_HARI} hari ke belakang.
          </small>
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
            <Tombol
              type="submit"
              disabled={sedang || keterangan.trim().length < 3 || !berkas || jumlahHari < 1 || jumlahHari > MAKS_RENTANG}
            >
              {sedang ? 'Mengirim…' : `Kirim pengajuan ${jenis.toLowerCase()}`}
            </Tombol>
          </p>
        </form>
      </Kartu>
>>>>>>> Stashed changes

      <Kartu t="Riwayat pengajuan saya">
        <p className="text-[11px] text-mu -mt-1 mb-3">
          {daftar === null ? 'Memuat pengajuan…' : `${daftar.length} pengajuan tercatat.`}
        </p>
        {daftar === null ? (
          <div className="flex items-center gap-2 text-mu text-sm py-2">
            <Ikon nama="refresh" className="size-4 animate-spin" />
            Memuat pengajuan…
          </div>
        ) : daftar.length === 0 ? (
          <p className="text-mu text-sm mb-0">Belum ada pengajuan. Kirim lewat formulir di atas bila perlu.</p>
        ) : (
          <ul className="list-none p-0 m-0 grid md:grid-cols-2 gap-3">
            {daftar.map((p) => (
              <li key={p.id} className="border border-garis rounded-xl p-3.5">
                <div className="flex flex-wrap items-center gap-2">
<<<<<<< Updated upstream
                  <b className="text-[11.5px]">{tglIndoRentang(p.tanggal, p.tanggal_selesai)}</b>
=======
                  <b className="text-sm">{tglRentang(p.tanggal, p.tanggal_akhir)}</b>
>>>>>>> Stashed changes
                  <Badge s={p.jenis} />
                  <Badge s={p.status} />
                </div>
                <p className="text-[11.5px] mt-1.5 mb-2 whitespace-pre-line text-[#334155] leading-relaxed">{p.keterangan}</p>
                <button
                  type="button"
                  onClick={() => ubahBukti(p)}
                  className="inline-flex items-center gap-1.5 text-pr text-[11px] font-semibold no-underline hover:underline"
                >
                  <Ikon nama="eye" className="size-3.5" />
                  Lihat bukti foto
                </button>
                {p.status === 'Ditolak' && p.catatan_putusan ? (
                  <div className="mt-2">
                    <Pemberitahuan jenis="er" judul="Ditolak oleh pembimbing" uraian={p.catatan_putusan} />
                  </div>
                ) : null}
                {p.status === 'Menunggu' ? (
                  <p className="text-mu text-[10.5px] mt-2 mb-0">Menunggu putusan pembimbing.</p>
                ) : null}
                {p.status === 'Disetujui' ? (
<<<<<<< Updated upstream
                  <p className="text-g text-[10.5px] font-semibold mt-2 mb-0">
                    Disetujui — tanggal tersebut terekam {p.jenis.toLowerCase()} dan tidak perlu absen.
=======
                  <p className="text-g text-xs font-semibold mt-2 mb-0">
                    Disetujui — rentang tanggal tersebut terekam {p.jenis.toLowerCase()} dan tidak perlu absen.
>>>>>>> Stashed changes
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Kartu>

      <PenampilFoto
        buka={bukti !== null}
        judul={bukti ? `Bukti ${bukti.jenis} ${tglIndoRentang(bukti.tanggal, bukti.tanggal_selesai)}` : 'Bukti pengajuan'}
        sumber={bukti ? `/pengajuan/bukti/${bukti.bukti}` : ''}
        namaBerkas={bukti ? `bukti-${bukti.jenis.toLowerCase()}-${bukti.tanggal}` : 'bukti-pengajuan'}
        tutup={() => ubahBukti(null)}
      />
    </>
  );
}
