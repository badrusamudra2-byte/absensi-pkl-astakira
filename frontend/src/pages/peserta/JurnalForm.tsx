import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { JurnalDetail } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Masukan, Galat, Badge, JudulHalaman } from '../../komponen/ui';
import { Ikon } from '../../komponen/Ikon';
import { useToast } from '../../komponen/Toast';
import { useOnline } from '../../komponen/Offline';
import { PenampilFoto } from '../../komponen/PenampilFoto';
import { isoHariSilam } from '../../komponen/umum';

const MAKS_TEKS = 5000;

// Selalu WIB (Asia/Jakarta), sama seperti server — bukan tanggal UTC mesin.
const hariBatas = isoHariSilam;

interface Isian { tanggal: string; judul: string; uraian: string; hasil: string; kendala: string; rencana: string; }
// Dibuat per render (bukan konstanta modul) agar tanggal default selalu hari ini —
// aplikasi yang tertinggal terbuka semalaman tetap mengisi tanggal benar saat dibuka.
const kosong = (): Isian => ({ tanggal: hariBatas(0), judul: '', uraian: '', hasil: '', kendala: '', rencana: '' });

/** Penghitung karakter kecil di bawah textarea/input. */
function Hitung({ leng, maks }: { leng: number; maks: number }) {
  return (
    <small aria-live="off" className={`text-xs ${leng > maks ? 'text-r' : 'text-mu'}`}>{leng}/{maks}</small>
  );
}

export default function JurnalForm() {
  const { id } = useParams(); // ada -> mode edit
  const editMode = id !== undefined;
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  // Dibuka dari daftar jurnal (?tanggal=): tanggal terkunci sesuai absensi —
  // peserta mengisi jurnal untuk hari itu, bukan memilih tanggal bebas.
  const kunci = sp.get('tanggal');
  const tanggalTerkunci = kunci && /^\d{4}-\d{2}-\d{2}$/.test(kunci) ? kunci : null;
  const toast = useToast();
  const daring = useOnline();
  const [isi, ubahIsi] = useState<Isian>(() => ({ ...kosong(), tanggal: tanggalTerkunci ?? hariBatas(0) }));
  const [judulErr, ubahJudulErr] = useState('');
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [sedang, ubahSedang] = useState(false);
  const [konfirm, ubahKonfirm] = useState(false);
  const [statusLama, ubahStatusLama] = useState<string | null>(null);
  const [lampiranLama, ubahLampiranLama] = useState<string | null>(null);
  const [berkas, ubahBerkas] = useState<File | null>(null);
  const [muat, ubahMuat] = useState(editMode);
  const [bukaFoto, ubahBukaFoto] = useState(false);

  /* Mode edit: muat isi jurnal (dan pastikan milik peserta) */
  useEffect(() => {
    if (!editMode) return;
    api<JurnalDetail>(`/jurnal/${id}`)
      .then((j) => {
        if (!['Draft', 'Revisi'].includes(j.status)) {
          ubahGalat(teksKode('STATUS_TIDAK_VALID', `Jurnal berstatus ${j.status} tidak bisa diubah.`));
        }
        ubahStatusLama(j.status);
        ubahLampiranLama(j.lampiran ?? null);
        ubahIsi({
          tanggal: j.tanggal,
          judul: j.judul,
          uraian: j.uraian,
          hasil: j.hasil ?? '',
          kendala: j.kendala ?? '',
          rencana: j.rencana ?? '',
        });
      })
      .catch((e) => ubahGalat(teksKode((e as ApiError).kode ?? 'SERVER', (e as ApiError).message)))
      .finally(() => ubahMuat(false));
  }, [editMode, id]);

  const sah = (kirim: boolean): boolean => {
    let bener = true;
    ubahJudulErr('');
    if (!tanggalTerkunci && (!/^\d{4}-\d{2}-\d{2}$/.test(isi.tanggal) || isi.tanggal > hariBatas(0))) {
      ubahGalat(['Tanggal tidak sesuai', 'Tanggal jurnal tidak boleh di masa depan.']);
      bener = false;
    }
    if (!isi.judul.trim() || !isi.uraian.trim()) {
      ubahJudulErr(isi.judul.trim() ? 'Uraian kegiatan wajib diisi.' : 'Judul kegiatan wajib diisi.');
      bener = false;
    }
    void kirim;
    return bener;
  };

  const simpan = async (kirim: boolean) => {
    if (!sah(kirim)) return;
    if (!daring) {
      ubahGalat(['Tidak ada koneksi internet', 'Jurnal butuh server untuk disimpan atau dikirim. Hubungkan internet lalu coba lagi.']);
      ubahKonfirm(false);
      return;
    }
    ubahSedang(true);
    ubahGalat(null);
    const badan = { ...isi, aksi: kirim ? 'kirim' : 'draft' };
    try {
      let idJurnal: number;
      let pesan: string;
      // Bila ada lampiran: simpan dulu tanpa mengirim, unggah lampiran, baru kirim.
      // Urutan ini penting — jurnal Dikirim tidak boleh diubah, jadi lampiran yang
      // diunggah setelahnya akan ditolak server.
      if (berkas) {
        const draf = await (editMode
          ? api<{ id: number }>(`/jurnal/${id}`, { method: 'PUT', json: { ...isi, aksi: 'draft' } })
          : api<{ id: number }>('/jurnal', { method: 'POST', json: { ...isi, aksi: 'draft' } }));
        idJurnal = draf.id;
        const fd = new FormData();
        fd.append('lampiran', berkas);
        await api<{ lampiran: string }>(`/jurnal/${idJurnal}/lampiran`, { method: 'PUT', bentuk: fd });
        if (kirim) {
          await api<{ id: number }>(`/jurnal/${idJurnal}`, { method: 'PUT', json: { ...isi, aksi: 'kirim' } });
        }
        pesan = kirim ? 'Jurnal dikirim.' : 'Draft jurnal disimpan.';
      } else if (editMode) {
        const r = await api<{ id: number; status: string }>(`/jurnal/${id}`, { method: 'PUT', json: badan });
        idJurnal = r.id;
        pesan = statusLama === 'Revisi' ? 'Jurnal diperbaiki dan dikirim.' : badan.aksi === 'kirim' ? 'Jurnal dikirim.' : 'Perubahan draft disimpan.';
      } else {
        const r = await api<{ id: number; status: string }>('/jurnal', { method: 'POST', json: badan });
        idJurnal = r.id;
        pesan = badan.aksi === 'kirim' ? 'Jurnal dikirim.' : 'Draft jurnal disimpan.';
      }
      toast(pesan);
      navigate(`/jurnal/${idJurnal}`);
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
      ubahKonfirm(false);
    } finally {
      ubahSedang(false);
    }
  };

  /** Hapus lampiran saat ini (hanya di mode edit; jurnal Draft/Revisi). */
  const hapusLampiran = async () => {
    if (!editMode) return;
    try {
      await api<{ pesan: string }>(`/jurnal/${id}/lampiran`, { method: 'DELETE' });
      ubahLampiranLama(null);
      ubahBerkas(null);
      toast('Lampiran kegiatan dihapus.');
    } catch (e) {
      ubahGalat(teksKode((e as ApiError).kode ?? 'SERVER', (e as ApiError).message));
    }
  };

  if (muat) {
    return (
      <>
        <JudulHalaman eyebrow="Peserta PKL" judul="Jurnal" sub="Memuat isi jurnal…" />
        <Kartu>
          <div className="flex items-center gap-2 text-mu text-sm py-2">
            <Ikon nama="refresh" className="size-4 animate-spin" />
            Memuat jurnal…
          </div>
        </Kartu>
      </>
    );
  }

  const revisi = statusLama === 'Revisi';
  const judulHalaman = editMode ? (revisi ? 'Perbaiki Jurnal' : 'Ubah Jurnal') : 'Jurnal Baru';

  return (
    <>
      <JudulHalaman
        eyebrow="Peserta PKL"
        judul={judulHalaman}
        sub={revisi ? 'Perbaiki isian sesuai catatan pembimbing, lalu kirim ulang.' : 'Tulis kegiatan harian PKL Anda dengan lengkap.'}
      />

      <Kartu className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-garis">
          <div className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-pl text-pr grid place-items-center">
              <Ikon nama="book" className="size-4" />
            </span>
            <b className="text-[12.5px] font-extrabold">{editMode ? (revisi ? 'Perbaiki jurnal' : 'Ubah jurnal') : 'Jurnal baru'}</b>
          </div>
          {statusLama ? <Badge s={statusLama} /> : null}
        </div>

        <div className="p-4 md:p-5">
          {galat ? (
            <div className="mb-3">
              <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
            </div>
          ) : null}
          {revisi ? (
            <Pemberitahuan jenis="warn" judul="Jurnal perlu revisi" uraian="Ubah isian di bawah lalu tekan Perbaiki dan kirim ulang." />
          ) : null}

          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[1px] text-pr mt-4 mb-2">
            <Ikon nama="file" className="size-3.5" />
            Detail kegiatan
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="tgl" className="block text-[11px] font-bold text-[#4a5a72] mb-1">Tanggal kegiatan</label>
              <input
                id="tgl" type="date" value={isi.tanggal}
                disabled={!!tanggalTerkunci}
                max={hariBatas(0)}
                onChange={(e) => ubahIsi({ ...isi, tanggal: e.target.value })}
                className="block w-full h-[38px] px-3 border border-garis rounded-lg bg-bg text-[12px] disabled:text-mu disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
              />
              <small className="block text-mu text-[10px] mt-1 leading-snug">
                {tanggalTerkunci
                  ? 'Tanggal terkunci sesuai absensi Anda — isi jurnal untuk hari itu.'
                  : 'Tanpa masa depan. Hanya tanggal yang Anda absen masuk yang bisa diisi.'}
              </small>
            </div>
            <div>
              <label htmlFor="jdl" className="block text-[11px] font-bold text-[#4a5a72] mb-1">Judul kegiatan</label>
              <Masukan
                id="jdl" value={isi.judul} maxLength={150}
                onChange={(e) => ubahIsi({ ...isi, judul: e.target.value })}
                placeholder="Contoh: Membuat wireframe halaman utama"
                className="!mt-0 !h-[38px]"
              />
              <span className="flex justify-between mt-1"><Galat pesan={judulErr} /><Hitung leng={isi.judul.length} maks={150} /></span>
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor="ura" className="block text-[11px] font-bold text-[#4a5a72] mb-1">
              Uraian kegiatan <span className="text-r">wajib</span>
            </label>
            <textarea
              id="ura" value={isi.uraian} maxLength={MAKS_TEKS} rows={4}
              onChange={(e) => ubahIsi({ ...isi, uraian: e.target.value })}
              className="block w-full px-3 py-2 border border-garis rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
              placeholder="Rincian kegiatan yang Anda kerjakan pada tanggal tersebut"
            />
            <span className="block text-right"><Hitung leng={isi.uraian.length} maks={MAKS_TEKS} /></span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[1px] text-pr mt-5 mb-2 pt-4 border-t border-garis">
            <Ikon nama="activity" className="size-3.5" />
            Hasil dan rencana
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="hsl" className="block text-[11px] font-bold text-[#4a5a72] mb-1">Hasil</label>
              <textarea id="hsl" value={isi.hasil} maxLength={MAKS_TEKS} rows={3}
                onChange={(e) => ubahIsi({ ...isi, hasil: e.target.value })}
                className="block w-full px-3 py-2 border border-garis rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
                placeholder="Capaian atau output kegiatan (boleh kosong)" />
              <span className="block text-right"><Hitung leng={isi.hasil.length} maks={MAKS_TEKS} /></span>
            </div>
            <div>
              <label htmlFor="kdl" className="block text-[11px] font-bold text-[#4a5a72] mb-1">Kendala</label>
              <textarea id="kdl" value={isi.kendala} maxLength={MAKS_TEKS} rows={3}
                onChange={(e) => ubahIsi({ ...isi, kendala: e.target.value })}
                className="block w-full px-3 py-2 border border-garis rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
                placeholder="Hambatan yang ditemui (boleh kosong)" />
              <span className="block text-right"><Hitung leng={isi.kendala.length} maks={MAKS_TEKS} /></span>
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor="rnc" className="block text-[11px] font-bold text-[#4a5a72] mb-1">Rencana berikutnya</label>
            <textarea id="rnc" value={isi.rencana} maxLength={MAKS_TEKS} rows={3}
              onChange={(e) => ubahIsi({ ...isi, rencana: e.target.value })}
              className="block w-full px-3 py-2 border border-garis rounded-lg bg-bg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe]"
              placeholder="Langkah lanjutan (boleh kosong)" />
            <span className="block text-right"><Hitung leng={isi.rencana.length} maks={MAKS_TEKS} /></span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[1px] text-pr mt-5 mb-2 pt-4 border-t border-garis">
            <Ikon nama="image" className="size-3.5" />
            Lampiran
          </div>
          <div>
            <label htmlFor="lmp" className="block text-[11px] font-bold text-[#4a5a72] mb-1">Foto kegiatan (opsional)</label>
            {lampiranLama ? (
              <span className="flex items-center gap-2 text-[11.5px] mb-2">
                <Ikon nama="image" className="size-3.5 text-mu" />
                Lampiran saat ini:
                <button type="button" onClick={() => ubahBukaFoto(true)} className="text-pr font-semibold underline">Lihat</button>
                <span className="text-[#c3cede]">·</span>
                <button type="button" onClick={() => void hapusLampiran()} className="text-r font-semibold underline">Hapus</button>
              </span>
            ) : null}
            <input
              id="lmp" type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => ubahBerkas(e.target.files?.[0] ?? null)}
              className="block w-full text-[11.5px] text-mu file:mr-2 file:px-3 file:py-[6px] file:rounded-lg file:border file:border-garis file:bg-bg file:text-[11.5px] file:cursor-pointer"
            />
            <small className="block text-mu text-[10px] mt-1">JPG, PNG, atau WebP, maksimal 5 MB.</small>
          </div>

          {konfirm ? (
            <div className="mt-4 border border-y rounded-xl px-[14px] py-3 bg-[#fffbeb]" role="dialog" aria-label="Konfirmasi kirim jurnal">
              <b className="block mb-1 text-[12.5px]">Kirim jurnal sekarang?</b>
              <p className="text-[11.5px] mb-2 text-[#4a5a72]">
                Jurnal terkirim dan tidak bisa diubah sampai pembimbing menyetujui atau minta revisi.
              </p>
              <div className="flex gap-2">
                <Tombol onClick={() => void simpan(true)} disabled={sedang}>Ya, kirim</Tombol>
                <Tombol varian="gh" onClick={() => ubahKonfirm(false)} disabled={sedang}>Batal</Tombol>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-garis">
              {revisi ? (
                <Tombol onClick={() => ubahKonfirm(true)} disabled={sedang}>Perbaiki dan kirim ulang</Tombol>
              ) : (
                <>
                  <Tombol varian="gh" onClick={() => void simpan(false)} disabled={sedang}>Simpan draft</Tombol>
                  <Tombol onClick={() => ubahKonfirm(true)} disabled={sedang}>Kirim jurnal</Tombol>
                </>
              )}
              {sedang ? <span className="text-mu text-[11.5px] self-center">Mengirim…</span> : null}
              {!daring ? <span className="text-r text-[11.5px] font-semibold self-center" role="alert">Luring — isian bisa ditulis, pengiriman butuh koneksi.</span> : null}
            </div>
          )}
        </div>
      </Kartu>

      {bukaFoto && id ? (
        <PenampilFoto
          buka={bukaFoto}
          judul={`Lampiran kegiatan ${isi.tanggal}`}
          sumber={`/jurnal/${id}/lampiran`}
          namaBerkas={`lampiran-jurnal-${isi.tanggal}`}
          tutup={() => ubahBukaFoto(false)}
        />
      ) : null}
    </>
  );
}
