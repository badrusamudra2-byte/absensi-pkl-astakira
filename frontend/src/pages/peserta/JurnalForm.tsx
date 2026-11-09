import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { teksKode } from '../../lib/petaKode';
import type { JurnalDetail } from '../../lib/tipe';
import { Kartu, Tombol, Pemberitahuan, Masukan, Galat } from '../../komponen/ui';
import { useToast } from '../../komponen/Toast';
import { useOnline } from '../../komponen/Offline';

const MAKS_BELAKANG = 7; // sejajar env JURNAL_MAKS_HARI_BELAKANG backend
const MAKS_TEKS = 5000;

const hariBatas = (geser: number) => new Date(Date.now() - geser * 86400000).toISOString().slice(0, 10);

interface Isian { tanggal: string; judul: string; uraian: string; hasil: string; kendala: string; rencana: string; }
const KOSONG: Isian = { tanggal: hariBatas(0), judul: '', uraian: '', hasil: '', kendala: '', rencana: '' };

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
  const toast = useToast();
  const daring = useOnline();
  const [isi, ubahIsi] = useState<Isian>({ ...KOSONG });
  const [judulErr, ubahJudulErr] = useState('');
  const [galat, ubahGalat] = useState<[string, string] | null>(null);
  const [sedang, ubahSedang] = useState(false);
  const [konfirm, ubahKonfirm] = useState(false);
  const [statusLama, ubahStatusLama] = useState<string | null>(null);
  const [muat, ubahMuat] = useState(editMode);

  /* Mode edit: muat isi jurnal (dan pastikan milik peserta) */
  useEffect(() => {
    if (!editMode) return;
    api<JurnalDetail>(`/jurnal/${id}`)
      .then((j) => {
        if (!['Draft', 'Revisi'].includes(j.status)) {
          ubahGalat(teksKode('STATUS_TIDAK_VALID', `Jurnal berstatus ${j.status} tidak bisa diubah.`));
        }
        ubahStatusLama(j.status);
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isi.tanggal) || isi.tanggal > hariBatas(0) || isi.tanggal < hariBatas(MAKS_BELAKANG)) {
      ubahGalat(['Tanggal tidak sesuai', `Pilih tanggal antara ${hariBatas(MAKS_BELAKANG)} dan ${hariBatas(0)}.`]);
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
      if (editMode) {
        const r = await api<{ id: number; status: string }>(`/jurnal/${id}`, { method: 'PUT', json: badan });
        toast(statusLama === 'Revisi' ? 'Jurnal diperbaiki dan dikirim.' : badan.aksi === 'kirim' ? 'Jurnal dikirim.' : 'Perubahan draft disimpan.');
        navigate(`/jurnal/${r.id}`);
      } else {
        const r = await api<{ id: number; status: string }>('/jurnal', { method: 'POST', json: badan });
        toast(badan.aksi === 'kirim' ? 'Jurnal dikirim.' : 'Draft jurnal disimpan.');
        navigate(`/jurnal/${r.id}`);
      }
    } catch (e) {
      const err = e as ApiError;
      ubahGalat(teksKode(err.kode ?? 'SERVER', err.message));
      ubahKonfirm(false);
    } finally {
      ubahSedang(false);
    }
  };

  if (muat) {
    return <Kartu t="Jurnal"><p className="text-mu text-sm">Memuat jurnal…</p></Kartu>;
  }

  const revisi = statusLama === 'Revisi';

  return (
    <>
      <Kartu t={editMode ? (revisi ? 'Perbaiki jurnal (Perlu revisi)' : 'Ubah jurnal') : 'Jurnal baru'}>
        {galat ? (
          <div className="mb-3">
            <Pemberitahuan jenis="er" judul={galat[0]} uraian={galat[1]} />
          </div>
        ) : null}
        {revisi ? (
          <Pemberitahuan jenis="warn" judul="Jurnal perlu revisi" uraian="Ubah isian di bawah lalu tekan Perbaiki dan kirim ulang." />
        ) : null}

        <p>
          <label htmlFor="tgl" className="block text-[13px] font-semibold mt-3">Tanggal kegiatan</label>
          <input
            id="tgl" type="date" value={isi.tanggal}
            min={hariBatas(MAKS_BELAKANG)} max={hariBatas(0)}
            onChange={(e) => ubahIsi({ ...isi, tanggal: e.target.value })}
            className="block mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
          />
          <small className="text-mu text-xs">Hingga {MAKS_BELAKANG} hari ke belakang, tanpa masa depan.</small>
        </p>
        <p>
          <label htmlFor="jdl" className="block text-[13px] font-semibold mt-3">Judul kegiatan</label>
          <Masukan
            id="jdl" value={isi.judul} maxLength={150}
            onChange={(e) => ubahIsi({ ...isi, judul: e.target.value })}
            placeholder="Contoh: Membuat wireframe halaman utama"
          />
          <span className="flex justify-between mt-1"><Galat pesan={judulErr} /><Hitung leng={isi.judul.length} maks={150} /></span>
        </p>
        <p>
          <label htmlFor="ura" className="block text-[13px] font-semibold mt-3">Uraian kegiatan (wajib)</label>
          <textarea
            id="ura" value={isi.uraian} maxLength={MAKS_TEKS} rows={4}
            onChange={(e) => ubahIsi({ ...isi, uraian: e.target.value })}
            className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
            placeholder="Rincian kegiatan yang Anda kerjakan pada tanggal tersebut"
          />
          <span className="block text-right"><Hitung leng={isi.uraian.length} maks={MAKS_TEKS} /></span>
        </p>
        <p>
          <label htmlFor="hsl" className="block text-[13px] font-semibold">Hasil</label>
          <textarea id="hsl" value={isi.hasil} maxLength={MAKS_TEKS} rows={3}
            onChange={(e) => ubahIsi({ ...isi, hasil: e.target.value })}
            className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
            placeholder="Capaian atau output kegiatan (boleh kosong)" />
          <span className="block text-right"><Hitung leng={isi.hasil.length} maks={MAKS_TEKS} /></span>
        </p>
        <p>
          <label htmlFor="kdl" className="block text-[13px] font-semibold">Kendala</label>
          <textarea id="kdl" value={isi.kendala} maxLength={MAKS_TEKS} rows={3}
            onChange={(e) => ubahIsi({ ...isi, kendala: e.target.value })}
            className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
            placeholder="Hambatan yang ditemui (boleh kosong)" />
          <span className="block text-right"><Hitung leng={isi.kendala.length} maks={MAKS_TEKS} /></span>
        </p>
        <p>
          <label htmlFor="rnc" className="block text-[13px] font-semibold">Rencana berikutnya</label>
          <textarea id="rnc" value={isi.rencana} maxLength={MAKS_TEKS} rows={3}
            onChange={(e) => ubahIsi({ ...isi, rencana: e.target.value })}
            className="block w-full mt-1 px-[11px] py-[9px] border border-garis rounded-lg bg-bg"
            placeholder="Langkah lanjutan (boleh kosong)" />
          <span className="block text-right"><Hitung leng={isi.rencana.length} maks={MAKS_TEKS} /></span>
        </p>

        {konfirm ? (
          <div className="mt-4 border border-y rounded-lg px-[14px] py-3" role="dialog" aria-label="Konfirmasi kirim jurnal">
            <b className="block mb-1">Kirim jurnal sekarang?</b>
            <p className="text-sm mb-2">Jurnal terkirim dan tidak bisa diubah sampai pembimbing menyetujui atau minta revisi.</p>
            <div className="flex gap-2">
              <Tombol onClick={() => void simpan(true)} disabled={sedang}>Ya, kirim</Tombol>
              <Tombol varian="gh" onClick={() => ubahKonfirm(false)} disabled={sedang}>Batal</Tombol>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mt-4">
            {revisi ? (
              <Tombol onClick={() => ubahKonfirm(true)} disabled={sedang}>Perbaiki dan kirim ulang</Tombol>
            ) : (
              <>
                <Tombol varian="gh" onClick={() => void simpan(false)} disabled={sedang}>Simpan draft</Tombol>
                <Tombol onClick={() => ubahKonfirm(true)} disabled={sedang}>Kirim jurnal</Tombol>
              </>
            )}
            {sedang ? <span className="text-mu text-sm self-center">Mengirim…</span> : null}
            {!daring ? <span className="text-r text-sm font-semibold self-center" role="alert">Luring — isian bisa ditulis, pengiriman butuh koneksi.</span> : null}
          </div>
        )}
      </Kartu>
    </>
  );
}
